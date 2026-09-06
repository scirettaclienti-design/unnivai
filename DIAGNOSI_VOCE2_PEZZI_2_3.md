# Diagnosi voce 2 — pezzi 2 e 3

**Data:** 04/09/2026 · **Modalità:** read-only, zero modifiche, zero commit
**Schema verificato su Supabase live** (progetto `UNNIVAI` / `ahecpiwsdhghkndncejb`,
ACTIVE_HEALTHY) via MCP, **non a memoria**.

---

## 0. FUORI MANDATO, MA VA LETTO PER PRIMO — `guide_requests` è leggibile da chiunque

Non l'ho cercato: è emerso ispezionando le RLS per il punto 1. **L'ho verificato
empiricamente**, non dedotto dalle policy.

Chiamata REST con la sola **chiave anon** (quella che viaggia nel bundle
client, quindi pubblica), **senza alcuna autenticazione**:

```
GET /rest/v1/guide_requests?select=id,user_name,city,status,request_text,guide_id
→ 200, righe reali
```

Cosa è tornato, testuale:

- `"user_name": "ivano sciretta"` — nome e cognome reali
- `"request_text": "Vorrei visitare Roma di notte, siamo un gruppo di cinque persone"`
- e su una terza riga, in chiaro: **numero di telefono, indirizzo email, handle
  Instagram e link WhatsApp** (`+39 333 ...`, `ivano@gmail.com`, `@ivano_test`,
  `wa.me/39...`). Sono di un test QA, ma la forma è quella: **il campo libero
  della richiesta è PII in chiaro, e non è protetto.**

**Perché accade.** Tre policy `SELECT`, tutte `PERMISSIVE` → i loro `USING` si
combinano in **OR**, quindi vale la più larga:

| policy | ruolo | `USING` |
|---|---|---|
| `Users read own requests` | **`public`** | `auth.uid() = user_id` **OR `status = 'open'`** |
| `Guides view own and open requests` | **`public`** | `... OR guide_id = auth.uid()` **OR `guide_id IS NULL`** |
| `Guides see local requests` | `authenticated` | `city = (SELECT city FROM profiles WHERE id = auth.uid())` |

Bastano `status = 'open'` **oppure** `guide_id IS NULL` per aprire la riga a
chiunque — e il ruolo è `public`, che **include `anon`**. Le prime due non
verificano nessun ruolo: il nome "Guides..." descrive un'intenzione che il
predicato non implementa.

`Profile.jsx` filtra `.eq('user_id', userId)` **lato client**: nasconde le
richieste altrui nella UI, non nei dati. Il filtro sta dalla parte sbagliata.

**Non ho toccato nulla** — è una modifica di RLS, va decisa da te e ha un suo
gate. Ma precede per gravità entrambi i pezzi qui sotto: è l'unica cosa in
questo report che riguarda dati personali di persone reali già nel database.

---

## 1. Da dove legge oggi "Richieste Attive"

### Dati reali, nessun fallback fabbricato

`src/pages/Profile.jsx:109-119`, dentro `fetchProfileData`:

```js
const { data: requests, error: reqError } = await supabase
    .from('guide_requests')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(100);

if (!reqError && requests) setMyRequests(requests);
```

- **Nessun mock, nessun placeholder, nessun seed.** Se la query fallisce,
  `myRequests` resta `[]`.
- Empty state onesto a `:352-353`: *"Non hai richieste attive al momento."*
- Render a `:355-385`; il pallino arancione sul bottone "Richieste" (`:293`)
  dipende da `myRequests.length`, quindi anch'esso reale.

**Su questo punto il pezzo 2 è già pulito**: non c'è niente da spegnere, i dati
sono veri. Ci sono però **quattro difetti di verità nel modo in cui vengono
mostrati**, tutti misurati contro lo schema e i dati reali.

### 1a. Il badge di stato è codice morto — mostra la stringa grezza

`Profile.jsx:362-368` ramifica su `req.status === 'pending'` → *"In attesa"*,
`'accepted'` → *"Accettata"*, altrimenti stampa **`req.status` così com'è**.

Ma il CHECK sul DB è:

```sql
CHECK (status = ANY (ARRAY['open','accepted','declined','completed']))
```

**`'pending'` non è un valore ammesso.** Non esiste e non può esistere. Gli
stati realmente presenti oggi (misurati): `open`, `accepted`, `declined`.

Quindi il ramo *"In attesa"* **non si attiva mai**, e all'utente compare il
badge **`open`** — una parola inglese, grezza, in un'interfaccia italiana.

**Trappola collegata nello schema:** la colonna ha `DEFAULT 'pending'`, che
**viola il suo stesso CHECK**. Qualunque INSERT che ometta `status` fallisce.
Oggi non esplode solo perché `createGuideRequest` scrive `'open'` esplicito.

### 1b. Una richiesta RIFIUTATA compare sotto "Richieste Attive"

Il filtro esclude solo `completed`. Una richiesta con `status = 'declined'` —
e ce ne sono nel DB — resta in elenco, sotto un titolo che la dichiara attiva,
con il badge grezzo `declined`.

### 1c. "3 ore" è inventato quando il dato manca

`Profile.jsx:360`: `{req.duration || 3} ore`. Se `duration` è null, la
schermata **afferma tre ore** che nessuno ha mai scelto. È la regola locked #6
(un fatto, non un default di comodo).

### 1d. "Tour a " senza città — perché il payload la perde per strada

`Profile.jsx:359` stampa `Tour a {req.city}`. Nei dati reali **due righe su tre
hanno `city: null`**, e il titolo si riduce a *"Tour a "*.

Non è un caso: **`TourDetails.jsx:85-90` non passa `city`** nel payload (vedi
§3). Le richieste nate da lì arrivano in DB senza città.

### 1e. "Assegnata a una guida locale" + "Apri Chat" — reale, ma dice più di quel che sa

`:370-382`, mostrato quando `req.guide_id` è valorizzato. Il collegamento è
vero: FK `guide_requests_guide_id_profiles_fk → profiles(id)`, e nel DB
esistono **1 profilo con `role='guide'`** e **1 riga in `guides_profile`**.
Le richieste con guida assegnata sono **5 su 6**.

**"Apri Chat" non è finto.** `ChatModalUser` (`src/components/ChatModalUser.jsx`):
- legge la cronologia da `notifications` filtrando
  `action_data->>request_id = request.id` e `type IN ('guide_message','user_reply','price_offer')`
- invia inserendo una `notification` indirizzata a `request.guide_id`
- ha già la sanitizzazione dei contatti (`sanitizeMessage`)

È un canale di messaggi vero, costruito sopra `notifications`. **Non è un mock
da spegnere.** La domanda non è "è finto?", è **"V1 vuole promettere una chat
con le guide?"** — ed è una decisione tua, non una diagnosi.

L'unica frase che afferma più del dato è **"Assegnata a una guida locale"**:
`guide_id` prova che *una guida* è assegnata, **non che sia locale**. Nessun
confronto fra città della richiesta e città della guida avviene, da nessuna
parte.

---

## 2. Dove sono hardcoded le identità guida fabbricate

### 2a. I default nei mapper — la sorgente

| file:riga | valore fabbricato |
|---|---|
| `dataService.js:97` | `'Guida DoveVai'` (nome, se il join non dà nulla) |
| `dataService.js:98` | `'👋'` (avatar) — passando per `avatar_url` e `avatar_emoji`, **due colonne che non esistono su `profiles`** |
| `dataService.js:99` | `'Esperto locale appassionato.'` (**biografia inventata**) |
| `tourShape.js:466` | `'Intelligenza DoveVai'` (AI) / `'DoveVai Guide'` (non-AI) |
| `tourShape.js:467` | `'🤖'` (AI) / `'👋'` (non-AI) |

`'Intelligenza DoveVai'` + `🤖` sul ramo AI è **onesto e intenzionale**: dichiara
che è la macchina. Gli altri no: `'Guida DoveVai'`, `'DoveVai Guide'` e
soprattutto `'Esperto locale appassionato.'` **descrivono una persona che non
esiste**.

### 2b. TourDetails — il modal profilo guida, dove diventano schermo

`GuideProfileModal`, `src/pages/TourDetails.jsx:179-250`:

- **`:209`** — etichetta hardcoded sotto il nome: **`Guida DoveVai`**
- **`:221-222`** — statistica hardcoded: **`5+` / `ANNI EXP`**. Non viene da
  nessun dato: è scritta nel JSX.
- **`:229`** — biografia di fallback:
  *"Appassionato di storia locale e cultura **sarda**. Amo raccontare le storie
  nascoste che non troverai nelle guide turistiche tradizionali."*
  Una biografia inventata, per una persona inventata, **che dichiara la Sardegna
  a prescindere dalla città del tour**.

### 2c. La riparazione che non ha mai funzionato

`TourDetails.jsx:494-530` prova a sostituire i default con la guida vera:

```js
.from('profiles')
.select('first_name, last_name, username, image_urls, bio')
```

**`username` e `bio` NON esistono su `profiles`.** Verificato ora su
`information_schema`: fra le colonne cercate esistono solo `first_name`,
`last_name`, `image_urls`, `role`.

La query risponde **400** e l'`useEffect` esce su `if (error) return`. **Il
recupero della guida reale non è mai avvenuto**, quindi i default fabbricati
non venivano mai sostituiti. È la stessa forma del 400 di Esplora, nello
stesso file di sintomi.

### 2d. Nota di correzione all'handoff, e una buona notizia

- ***Marco Polo 4.9* e *Chiara Esposito 4.6* NON esistono più nel codice.**
  Zero occorrenze. L'handoff le elenca come presenti: **la voce è stale**.
- **Il modal guida oggi è di fatto irraggiungibile.** Si apre solo sotto
  `isGuideTour` (`:640`: `tour.type !== 'self-guided' && !tour.isAiGenerated`),
  e con `GUIDE_TOURS_ENABLED = false` `getTourById` ritorna `null`: a
  TourDetails arrivano **solo tour AI**, che hanno `isAiGenerated` → `isGuideTour`
  è falso. **La porta chiusa ha già messo a tacere queste identità.**

Sono **dormienti, non morte**: vivono nei default dei mapper e si risvegliano
il giorno che la porta si riapre, o che una superficie non coperta (Esplora)
torna a schermo. Vanno tolte comunque, ma **non sono un'emergenza a schermo**.

---

## 3. Schema reale di `guide_requests` vs quello che `createGuideRequest` scrive

### Colonne reali (12) — da `information_schema`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `user_id` | uuid | SÌ | — |
| `user_name` | text | SÌ | — |
| `city` | text | SÌ | — |
| `category` | text | SÌ | — |
| `duration` | **text** | SÌ | — |
| `status` | text | SÌ | **`'pending'`** ⚠️ viola il CHECK |
| `created_at` | timestamptz | SÌ | `now()` |
| `request_text` | text | SÌ | — |
| `guide_id` | uuid | SÌ | — |
| `tour_id` | uuid | SÌ | — |
| `notes` | text | SÌ | — |

**Vincoli:**
- `CHECK status IN ('open','accepted','declined','completed')`
- `guide_id → profiles(id)` ON DELETE CASCADE
- `user_id → auth.users(id)` ON DELETE CASCADE **e** `user_id → profiles(id)` ON DELETE CASCADE (**due FK sulla stessa colonna**)
- `tour_id → tours(id)` ON DELETE SET NULL

> Nota: `tour_id` **ha** una FK verso `tours`. È l'unica FK verso `tours` in
> tutto lo schema — e conferma che il 400 di Esplora nasce dall'assenza di una
> FK `tours.guide_id → profiles`, non da un problema di PostgREST.

### Cosa scrive `createGuideRequest` (`dataService.js:912-935`)

| campo scritto | valore | verdetto |
|---|---|---|
| `user_id` | `session.user.id` | ok |
| `user_name` | da `user_metadata` first/last, poi `full_name`, poi `'Ospite'` | ok |
| `guide_id` | `requestData.guideId` | ok (null = "a pioggia") |
| `tour_id` | `requestData.tourId` | ok |
| `city` | `requestData.city` | ok **se il chiamante la passa** |
| `status` | `'open'` | ok, rispetta il CHECK |
| `request_text` | `requestData.message` | ok |
| `category` | `'custom'` **hardcoded** | la colonna esiste ma non viene mai usata davvero |
| `duration` | `requestData.duration \|\| 3` | **numero in colonna `text`** → Postgres coerce a `'3'`; il `\|\| 3` inventa una durata |

**Campi mai scritti:** `notes` (esiste, sempre null).

**Campi ricevuti e SILENZIOSAMENTE SCARTATI:**
`createGuideRequest` accetta `requestData.date` e `requestData.guests` e
**non li scrive da nessuna parte** — non esistono colonne per loro.

- `TourDetails.jsx:85-90` passa `date` e `guests` **presi da un form che
  l'utente compila**. Vengono buttati. (Sono ricopiati a mano dentro
  `request_text` come testo libero, il che spiega il `"Data: 2026-06-25 /
  Ospiti: 3"` che si legge nei dati reali.)
- `DashboardUser.jsx:158-165` passa `date: 'Oggi'`, `guests: 2` — **due costanti
  finte**, anch'esse scartate.

**Divergenza fra i due chiamanti:**

| | `city` | `guideId` | esito |
|---|---|---|---|
| `DashboardUser` (modal "Tour su Misura") | **sì**, `requestCity` | `null` (a pioggia) | riga con città |
| `TourDetails` (modal richiesta guida) | **NO** | id della guida | **riga con `city: null`** → §1d |

---

## 4. Modifiche, separate per pezzo

### PEZZO 2 — "Richieste Attive" (richieste vere, niente fallback fabbricato)

Non c'è un fallback da uccidere: i dati sono reali. Le modifiche sono **di
verità nella presentazione**, tutte in `Profile.jsx`.

1. **`:362-368` — allineare gli stati al CHECK reale.** Togliere il ramo morto
   `'pending'`; mappare `open` → *"In attesa"*, `accepted` → *"Accettata"*,
   `declined` → *"Rifiutata"*. **Mai stampare `req.status` grezzo.**
2. **`:113` — decidere cosa vuol dire "attiva".** Se una richiesta rifiutata non
   è attiva, il filtro deve escludere anche `declined`; se resta, va sotto
   un'intestazione che non la chiami attiva. *(decisione tua)*
3. **`:360` — togliere `|| 3`.** Durata assente → non si stampa la riga durata.
4. **`:359` — gestire `city` null** senza stampare *"Tour a "*. Il fix vero è a
   monte (pezzo 3, punto 2): qui serve solo non mostrare una frase monca.
5. **`:374` — "Assegnata a una guida locale"** → *"Assegnata a una guida"*,
   oppure verificare davvero la città. Oggi la parola "locale" non è sostenuta
   da nessun confronto.
6. **Decisione tua, non tecnica: la chat resta o no in V1?** `ChatModalUser` è
   funzionante e reale. Se le guide non esistono come servizio, un canale di
   messaggi verso una guida è **la stessa promessa** dei tour-guida; se invece
   l'unica guida registrata è reale e risponde, allora è una feature vera che
   non va spenta. **Non tocco niente finché non decidi.**

**Fuori pezzo ma prioritario:** le policy RLS del §0. Modifica di schema, gate a
sé, ma riguarda PII già esposta.

### PEZZO 3 — modal "Tour su Misura" + `createGuideRequest`

1. **`dataService.js:930` — `duration`.** Colonna `text` che riceve un numero, e
   un `|| 3` che inventa. Decidere il tipo e smettere di inventare il default.
2. **`TourDetails.jsx:85-90` — aggiungere `city` al payload.** È la causa
   diretta di §1d. **Una riga**, ed è il fix più economico del lotto.
3. **`date` e `guests` scartati in silenzio.** O si aggiungono le colonne
   (`requested_date`, `guests`) e si scrivono, o **i campi si tolgono dai due
   form**. Oggi l'utente compila una data e un numero di persone che il sistema
   butta — e li recupera solo perché qualcuno li ricopia a mano dentro il testo
   libero. È la forma peggiore: **l'interfaccia chiede un dato e finge di
   riceverlo.**
4. **`DashboardUser.jsx:159-160` — `date: 'Oggi'`, `guests: 2`.** Due costanti
   finte passate a una funzione che le ignora. Vanno tolte in ogni caso.
5. **`category: 'custom'` hardcoded** (`dataService.js:929`): o si usa la
   colonna, o si dichiara che non serve.
6. **Il modal "Tour su Misura" (`DashboardUser.jsx:806-870`) resta o no?** È il
   gemello della decisione 6 del pezzo 2: *"Invia alle Guide di {città}"*
   promette un destinatario collettivo che in V1 è **una persona sola**
   (1 profilo `role='guide'`). **Decisione tua.**
7. **Schema — `status DEFAULT 'pending'` viola il CHECK.** Trappola dormiente:
   il primo INSERT che ometta `status` fallisce. Va nel gate schema insieme
   all'RLS e alla FK di Esplora.

---

## Cosa NON ho fatto

Zero modifiche al codice, zero commit, **`createGuideRequest` non toccata**
(era il vincolo: prima nel report, e adesso c'è). Nessuna modifica a RLS, a
schema o a dati — inclusa la fuga del §0, che ho solo **verificato in lettura**.
