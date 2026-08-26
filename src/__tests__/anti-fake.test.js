// Gate M — Test anti-rientro fake.
//
// Fa fallire la build se un pattern "finto" rientra nel codice viaggiatore.
// Gira in CI dopo unit+E2E: se qualcuno riaggiunge un rating hardcoded,
// una foto Unsplash "come se fosse la Villa Bellini", una coord Roma
// inline in un tour, o un bottone che dichiara di non funzionare — il
// deploy Vercel si blocca (via Gate F Ignored Build Step).
//
// Storia: audit anti-fake ha trovato 83 findings (60 CRITICA) tra
// dashboard guide/business + percorso viaggiatore. Gate D/E/J/K/L li
// hanno uccisi. Questo test impedisce che rientrino.
//
// Come si estende:
//   Nuovo pattern? Aggiungi una regola all'array RULES.
//   Falso positivo? Aggiungi il path all'allowlist della regola.
//   Ogni regola ha un `name` che appare nel diff — chi sblocca un file
//   deve dichiarare esplicitamente il perché.
//
// Come si legge un failure:
//   Il test stampa: "regola X ha trovato N violazioni:"
//   Poi per ogni violazione: "  <file>:<riga> → <line content>".

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

// ─── Configurazione ─────────────────────────────────────────────────────────

const REPO_ROOT = resolve(__dirname, '..', '..');
const SRC_ROOT = resolve(REPO_ROOT, 'src');

// Directory da NON scansionare — fake nei test è OK, nei doc idem.
const SKIP_DIRS = new Set([
    '__tests__',
    'test',
    'node_modules',
    'dist',
    'e2e',
    '.git',
]);

// File da NON scansionare — .old.jsx = dead code documentato, script dev.
const SKIP_FILE_SUFFIXES = ['.old.jsx', '.old.js', '.d.ts'];
const SKIP_FILE_NAMES = new Set([
    'sim_itinerary.js', // script dev locale, non nel bundle utente
]);

// Estensioni da scansionare.
const SCAN_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

// ─── Regole ────────────────────────────────────────────────────────────────

// `skip: true` → regola in it.skip (traccia della TODO ma non blocca build).
// Le regole partono skippate quando c'è violazione residua da fixare in un
// Gate futuro. Man mano che ripuliamo, togliamo lo skip e la regola diventa
// blocking (rientro = build rossa).
const RULES = [
    {
        name: 'no-rating-hardcoded',
        pattern: /\brating\s*:\s*["']?[1-5]\.[0-9]+["']?(?![a-z])/i,
        allowlist: [
            'src/pages/QuickPath.jsx',
            'src/services/placesDiscoveryService.js',
            // Gate O.2: allowlist per file NON in path Home. Rating fake residuo,
            // cleanup pianificato in Blocco 2.2/2.3 (SurpriseTour → via location
            // tour manager).
            'src/pages/SurpriseTour.jsx',
            //
            // GATE CLEANUP — quattro voci tolte:
            //  - 'src/pages/AiItinerary.jsx'  8 → 0, stavano tutte in `sampleItinerary`
            //  - 'src/services/locationTourService.js'  file cancellato
            //  - 'src/services/tourShape.js'  SCADUTA: l'unico `rating:` rimasto
            //    e' `Number.isFinite(raw.rating) ? raw.rating : null` (:354), cioe'
            //    un passaggio del dato vero, non un decimale scritto a mano.
            //  - 'src/services/aiRecommendationService.js'  SCADUTA: tutti i suoi
            //    `rating` leggono da Google Places (`p.rating`, `place.rating`),
            //    nessun letterale.
        ],
        message: 'Rating hardcoded. Le stelle vengono dal DB (tours.rating) o da Google Places.',
    },
    {
        name: 'no-reviews-hardcoded',
        pattern: /\breviews\s*:\s*["']?\d{2,}["']?/i,
        allowlist: [],
        message: 'Recensioni hardcoded. Vengono dal DB.',
    },
    {
        name: 'no-price-eur-hardcoded',
        pattern: /\bprice(_eur)?\s*:\s*[1-9]\d{1,3}\b(?![,.]\d)/,
        // GATE CLEANUP — allowlist SVUOTATA, tre voci tolte:
        //  - 'src/pages/AiItinerary.jsx'  6 → 0, stavano tutte in `sampleItinerary`
        //  - 'src/services/locationTourService.js'  file cancellato
        //  - 'src/pages/QuickPath.jsx'  SCADUTA: l'unico `price_eur:` rimasto e'
        //    `price_eur: 0` (:685), che il pattern non prende (vuole [1-9]) ed e'
        //    comunque un prezzo onesto, non finto.
        // Da qui in poi qualunque prezzo hardcoded, ovunque, fa rossa la build.
        allowlist: [],
        message: 'Prezzo hardcoded. price_eur viene dal DB tours.',
    },
    {
        name: 'no-fake-reviewer-names',
        pattern: /\b(Maria Benedetti|Giuseppe Torrisi|Andrea Morosini|Sofia|Marco R|Elena|Luca|Giulia)\b/,
        allowlist: [],
        message: 'Nome persona fake. Reviewer/guide/participants devono venire da profiles DB.',
        // SKIP ancora attivo: toglierlo e' il DIFF 6.
        //
        // GATE CLEANUP — i tre violatori che questa nota citava non esistono piu':
        //  - GroupInviteModal.jsx (2 'Sofia') → file CANCELLATO, zero importatori.
        //  - Landing.jsx ("Giulia" demo marketing) → gia' 0 occorrenze prima di
        //    questo gate: la nota citava un violatore che non c'era piu'.
        //  - TourDetails.jsx:950 → la riga vera era :973, e il "falso positivo"
        //    NON era filtrato dallo scanner (il filtro guarda l'inizio riga; quella
        //    e' una continuazione di commento JSX). Commento riscritto senza il
        //    nome fabbricato.
        // Violazioni residue oggi: 0.
        //
        // DIFF 6 (27/08) — SKIP TOLTO. La regola si e' accesa su uno zero, quindi
        // lo zero e' stato provato col metodo sonda e non creduto: piantata
        // `const reviewerName = 'Sofia';` in TourDetails.jsx (file vivo), vista la
        // riga rossa `src/pages/TourDetails.jsx:556`, rimossa. La regola VEDE.
    },
    {
        name: 'no-luogo-di-interesse-placeholder',
        pattern: /Luogo di interesse|Punto d['´]?interesse consigliato/i,
        allowlist: [
            // MapPage.jsx:480 e POIDetailDrawer:237/247 hanno GUARD
            // (`description !== "Punto..."`) che ESCLUDONO il segnaposto dal
            // render — le stringhe letterali sono dati di confronto, non da
            // mostrare. E' anti-fake, non fake.
            'src/pages/MapPage.jsx',
            'src/components/Map/POIDetailDrawer.jsx',
        ],
        message: 'Segnaposto placeholder. Usa description reale (narratore) o empty state onesto. Gate II ha eliminato le sorgenti: se rientra, e\' una regressione.',
        // Gate II — RIATTIVATA. Prima skip=true perche' DashboardUser:138
        // aveva il fallback `|| \`Luogo di interesse a ${cityName}\`` e
        // placesDiscoveryService.js:300 iniettava lo stesso testo nei
        // template di fallback. Ora entrambi ELIMINATI (Gate II unificato
        // narratore → description sempre vera, altrimenti stop scartato).
    },
    {
        name: 'no-unsplash-in-content',
        pattern: /images\.unsplash\.com/,
        allowlist: [
            // CORREZIONE F26 DIFF 4 (21/08). Qui c'era scritto:
            //   "Gate EE: rimosso 'src/pages/Landing.jsx' (unsplash avatar
            //    '+2.800 viaggiatori' cancellato — la landing non ha piu' foto stock)"
            // ed era FALSO. Il Gate EE rimosse l'avatar, NON l'hero: Landing.jsx:520
            // e' tuttora `photo-1552832230`, cioe' il Colosseo. La dichiarazione
            // affermava piu' di quanto fosse stato fatto, e nessuno se n'e' accorto
            // perche' la regola e' skip:true. E' la stessa bugia che questo file
            // esiste per uccidere, solo scritta dentro lo strumento.
            //
            // Landing.jsx resta in allowlist per un motivo NOMINATO, non per
            // categoria: e' l'hero della landing, non contenuto POI ne' copertina
            // tour, e non e' ancora stato sostituito. Gate a parte.
            'src/pages/Landing.jsx',
            //
            // GATE CLEANUP — sei voci tolte, per due motivi diversi.
            //
            // CANCELLATE COL FILE (esentavano un path inesistente):
            //   'src/utils/imageUtils.js'            52 occorrenze
            //   'src/services/locationTourService.js' 12
            //   'src/components/GroupInviteModal.jsx'  1
            // Con imageUtils e' andato via anche UnnivaiMap.old.jsx, che ne era
            // l'unico importatore residuo (cancellato PRIMA, non dopo).
            //
            // SCADUTE (esentavano zero occorrenze — una allowlist che non esenta
            // niente e' una dichiarazione falsa, lezione #26):
            //   'src/pages/AiItinerary.jsx'  8 → 0, stavano tutte in `sampleItinerary`
            //   'src/pages/QuickPath.jsx'    0, ripulito dal DIFF 5
            //   'src/pages/SurpriseTour.jsx' 0, ripulito dal DIFF 5
            //
            // DashboardGuide resta: 6 occorrenze VERE. Il codice e' SPENTO, non
            // morto — sta nel bundle ma V1LockedGuard non monta mai i children.
            // Debito differito che torna visibile il giorno che V2 si accende.
            'src/pages/DashboardGuide.jsx',
            //
            // DIFF 6 (27/08) — TERZA voce, per NOME e per MOTIVO.
            // DashboardUser.jsx:554 e :587 sono due texture di sfondo al 10% di
            // opacita' in blend overlay, poste via utility di background-image
            // arbitraria: non affermano un posto, non sono la foto di un POI ne'
            // la copertina di un tour. Nessun utente le legge come "questo e' il
            // luogo". Restano debito estetico per il Blocco Antigravity, non
            // debito di verita'.
            //
            // NB — le utility Tailwind qui sopra sono DESCRITTE, non scritte.
            // `tailwind.config.js` scansiona `./src/**/*.{js,jsx,ts,tsx}`, che
            // include questa cartella: una classe citata in un commento viene
            // EMESSA nel CSS come se fosse usata. La prima stesura di questa nota
            // conteneva la forma letterale del background arbitrario e ha
            // aggiunto 48 byte e un selettore inesistente al bundle. Vedi #35.
            'src/pages/DashboardUser.jsx',
        ],
        message: 'Unsplash dentro contenuto tour. Le foto vengono da Google Places photo API.',
        // DIFF 6 (27/08) — SKIP TOLTO. Tre voci in allowlist, ognuna per NOME e
        // per MOTIVO, mai per categoria: una regola con eccezioni categoriali
        // ("le texture", "il codice spento") smette di mordere, perche' la
        // categoria si allarga da sola al primo caso nuovo.
        //
        // Residuo misurato ad allowlist SVUOTATA: 9 (Landing 1 + DashboardUser 2
        // + DashboardGuide 6). Le tre esenzioni coprono esattamente quelle 9 e
        // niente altro: ad allowlist piena il residuo e' 0. Se il numero si
        // muove, si e' aggiunto unsplash da qualche parte.
    },
    {
        name: 'no-roma-coords-in-tour-content',
        pattern: /\b(41\.9028|12\.4964)\b/,
        allowlist: [
            // Gate CC.2b: rimosso 'src/pages/Explore.jsx' (mapCenter ora da resolveCityCenter).
            //
            // GATE CLEANUP — tre voci SCADUTE tolte:
            //  - 'src/components/Map/GoogleMapContainer.jsx'  l'unica occorrenza
            //    e' dentro il commento di Gate F38 che ne documenta la RIMOZIONE
            //    (:35). Lo scanner salta i commenti: esentava zero.
            //  - 'src/hooks/useEnhancedGeolocation.js'  zero occorrenze nel file.
            //  - 'src/pages/DashboardUser.jsx'  zero occorrenze nel file.
            'src/services/userContextService.js',
            'src/pages/Login.jsx',
            'src/pages/guide/TourBuilder.jsx',
            'src/data/demoData.js',
            'src/services/aiRecommendationService.js',
        ],
        message: 'Coord Roma inline. I tour usano coord reali da Google Places, non 41.9028/12.4964.',
    },
    {
        name: 'no-in-arrivo-toast',
        pattern: /(Funzione in arrivo|Funzionalità in arrivo|Coming soon)/i,
        allowlist: [
            // DIFF 6 (27/08) — UNA voce, per NOME e per MOTIVO.
            //
            // GuidePlaceholder.jsx:30 dice "Coming Soon" e NON e' una promessa
            // falsa: e' l'opposto. Dichiara che la V2 esiste e non e' pronta,
            // che e' esattamente cio' che questa regola vuole al posto di un
            // bottone che finge di funzionare. Esentata, non rimossa.
            //
            // L'esenzione e' per FILE perche' `isAllowlisted` confronta il path
            // intero: non esiste forma `path:riga`. Qui la perdita di
            // granularita' e' NULLA e misurata — nel file matcha una riga sola,
            // la :30. La :23 (`Funzionalita' {…} in arrivo.`) NON matcha, perche'
            // il pattern cerca "Funzionalita' in arrivo" contiguo e li' c'e'
            // un'interpolazione in mezzo. Il file e' un placeholder di 35 righe
            // irraggiungibile dietro V1LockedGuard: il file E' l'unita' di
            // eccezione. Se un giorno ospitera' altro, questa voce va rifatta.
            'src/pages/GuidePlaceholder.jsx',
        ],
        message: 'Toast "in arrivo" al posto della vera funzione. Se non esiste, non mostrare il bottone.',
        // DIFF 6 (27/08) — SKIP TOLTO. L'altro violatore, TourDetails
        // `handleFeatureIncoming` (toast chat-guida), e' stato RIMOSSO: prometteva
        // una chat diretta con le guide che non esiste. Trattamento diverso dal
        // "Coming Soon" perche' la classe e' diversa — uno promette, l'altro
        // dichiara di non poter promettere.
        //
        // NB: quel toast era gia' sorgente MORTO (zero call site; il bottone Chat
        // chiama handleChatClick). Il minifier lo droppava: `Funzione in arrivo`
        // era gia' assente dal bundle PRE. Rimuoverlo NON cambia il bundle JS.
        //
        // Lo zero di questa regola e' stato provato col metodo sonda e non
        // creduto: piantata `<p>Coming soon</p>` in TourDetails.jsx (file vivo,
        // NON in allowlist), vista la riga rossa, rimossa. La regola VEDE.
    },
    {
        // Gate F26 DIFF 6 (27/08) — regola NUOVA, nata da GuideChatModal.
        // Quel componente diceva "Questa e' una chat sicura e crittografata con
        // la tua guida ufficiale DoveVai" sopra un canale che non trasmetteva
        // niente: nessuna rete, nessun destinatario, un input senza handler.
        // Un'affermazione di sicurezza falsa e' la cosa piu' grave che questo
        // prodotto possa dire, perche' l'utente non ha modo di verificarla e
        // decide cosa scrivere fidandosi.
        //
        // COSA VIETA: l'affermazione di un MECCANISMO (crittografia, cifratura,
        // end-to-end) e la GARANZIA ASSOLUTA ("100% sicuro", "sicurezza
        // garantita"). Sono verificabili: o il meccanismo c'e' nel codice, o la
        // frase e' falsa.
        //
        // COSA NON VIETA, e perche' la regola puo' convivere con copy VERA:
        // l'aggettivo applicato a un processo delegato a un terzo che la
        // sicurezza la implementa davvero. Caso vivo oggi, misurato:
        // BookingSystem.jsx:260 dice "Verrai reindirizzato a Stripe per
        // completare il pagamento in sicurezza" — nomina il terzo, descrive il
        // reindirizzamento, non afferma un meccanismo che DoveVai non ha.
        // Passa, e DEVE passare. Per questo `sicur` nudo NON e' nel pattern: ha
        // 12 occorrenze, fra cui quella riga, "Assicurati di..." e "Sei sicuro
        // di voler eliminare". Un termine largo qui produrrebbe eccezioni, e le
        // eccezioni su una regola di sicurezza sono il modo di spegnerla.
        // Fuori dal pattern anche `e2e` (16 occorrenze: path, config, test).
        //
        // ALLOWLIST VUOTA, e va tenuta vuota. Se una violazione emerge non si
        // esenta il file: si verifica se l'affermazione e' VERA. Se lo diventa
        // — un canale cifrato per davvero — la strada non e' l'allowlist ma un
        // registro dei claim verificati, dove ogni frase e' accompagnata dal
        // meccanismo che la rende vera e da dove controllarlo. Quel registro
        // oggi non esiste e non va costruito in anticipo: non c'e' un solo
        // claim vero da registrarci.
        name: 'no-security-claims-in-copy',
        pattern: /crittografat|crittografia|cifrat[aeio]|end-to-end encrypt|sicurezza garantita|garantiamo (la |la tua |tua )?sicurezza|(100|cento)\s*%\s*sicur|totalmente sicur|completamente sicur|dati (sono )?al sicuro/i,
        allowlist: [],
        message: 'Affermazione di sicurezza nella copy. O il meccanismo esiste nel codice ed e\' dimostrabile, o la frase e\' falsa: l\'utente decide cosa scrivere fidandosi. Verifica se e\' vera, non esentare il file.',
    },
    {
        name: 'no-alert-instead-of-action',
        pattern: /\balert\s*\(/,
        allowlist: [],
        message: 'alert() nativo al posto di toast/UI. Usa il ToastProvider se serve comunicare.',
        // Attiva subito. Gate D-5 + J2 hanno tolto tutti gli alert() dal codice.
    },
    {
        name: 'no-math-random-in-rating-or-reviews',
        pattern: /Math\.random\(\)[\s\S]{0,80}?(rating|reviews)/i,
        allowlist: [],
        message: 'Rating/reviews via Math.random(). Genera dato falso; usa dati reali dal DB o mostra vuoto.',
    },
    // Gate O.2 — Nessun default hardcoded 'Roma' o `temperatureC: N` come
    // valore-ponte. Catch tre pattern:
    //   1. `|| 'Roma'` — fallback style
    //   2. `city: 'Roma'` / `city = 'Roma'` — default object / init
    //   3. `temperatureC: <numero>` — default value in initialData / state
    // Il path Home deve essere pulito: se citta'/temp non ci sono → skeleton,
    // non un dato-ponte con la faccia del dato reale.
    {
        name: 'no-hardcoded-city-or-temp-defaults',
        // Gate EE — aggiunto `useState\("Roma"\)` (bug Onboarding: selectedCity
        // useState('Roma') sembrava "città rilevata" ma era Roma hardcoded).
        pattern: /\|\|\s*["']Roma["']|\bcity\s*[:=]\s*["']Roma["']|\btemperatureC\s*:\s*\d+|useState\s*\(\s*["']Roma["']\s*\)/,
        allowlist: [
            // Componenti di autocompletamento indirizzo (visual placeholder tecnico).
            'src/components/AddressAutocomplete.jsx',
            // Fallback tecnico dentro il normalizer tour (defensive, non user-visible).
            'src/services/tourShape.js',
            // Pagine navigate non-Home. Cleanup pianificato Blocco 2.2-2.5.
            'src/pages/AiItinerary.jsx',
            'src/pages/QuickPath.jsx',
            'src/pages/SurpriseTour.jsx',
            'src/pages/TourDetails.jsx',
            // V2/V3 spente (guide/business). Non nel path Home V1.
            'src/pages/DashboardBusiness.jsx',
            'src/pages/guide/TourBuilder.jsx',
            // Gate EE: Landing.jsx e Onboarding.jsx NON in allowlist. La landing
            // e' la prima schermata del prodotto: vale le stesse regole del resto.
        ],
        message: '"Roma" hardcoded o `temperatureC: N` come default. Il path Home deve mostrare skeleton finche\' il dato non c\'e\', mai un valore-ponte.',
    },
    // Gate O.4 — Nessun rating/reviews renderizzato a livello TOUR nel JSX.
    // Il rating Google Places e' un fatto del singolo POI: mostrarlo aggregato
    // a livello tour = derivata inventata (media, somma, rating del "primo dell'array")
    // presentata come dato Google. Il pattern cattura letture tipiche in JSX:
    //   {exp.rating}, {tour.rating}, {experience.reviews}, {item.user_ratings_total}
    // NON cattura letture POI-level: {step.rating}, {poi.rating}, {exp.featuredPoi.rating}
    // (perche' tra `exp.` e `rating` c'e' `featuredPoi.`).
    {
        name: 'no-rating-or-reviews-at-tour-level',
        pattern: /\{(?:exp|tour|experience|item)\.(?:rating|reviews|reviewsCount|user_ratings_total)\b/,
        allowlist: [
            // Gate CC.2b: rimosso 'src/pages/Explore.jsx' (featuredPoi POI-level).
            // Gate Profilo L1 (ba2cb9e): rimosso 'src/pages/Profile.jsx' — 0
            // occorrenze del pattern, ora coperto dalla regola (rientro = build rossa).
            'src/pages/TourLive.jsx',
        ],
        message: 'Rating/reviews a livello TOUR nel JSX. Solo POI-level: usa exp.featuredPoi.rating o step.rating, mai un aggregato inventato del tour.',
    },
    // Gate AA — Nessuno stato di loading puo' dipendere dall'assenza di un
    // dato che l'utente non puo' fornire con un'azione immediata.
    // Bug del "Ciao, ...!" eterno: isLoading includeva `!effectiveCity`, ma
    // se GPS negato/fallito la citta' non arriva mai -> loading eterno ->
    // vicolo cieco. Il fix: distinguere "non lo so ancora" (loading vero:
    // gpsLoading/contextFetching) da "non lo so" (stato noto: needsCityChoice
    // -> apre CityModal onboarding).
    //
    // Pattern vietato in isLoading formulas: `!effectiveCity`, `!city`,
    // `!hasSomething`, ovvero negazione di dato user-scoped in un || di
    // isLoading. Se serve, va tradotto in uno stato esplicito con exit path.
    //
    // Allowlist ZERO: se qualcuno ci ricasca, la regola blocca in CI.
    // Regola locked (Ivano 14/07): "Nessun guard puo' creare uno stato
    // non-uscibile. Se un guard blocca una query, deve esistere un percorso
    // che permetta all'utente di sbloccarla".
    {
        name: 'no-loading-without-exit',
        pattern: /isLoading\s*[:=][^,;{}]*\|\|\s*!/,
        allowlist: [],
        message: 'isLoading dipende dalla negazione di un dato user-scoped (`!city`, `!effectiveCity`, ecc). Se il dato non arriva mai (GPS negato, IP bloccato) l\'app resta in loading eterno. Traduci in uno stato esplicito (es. `needsCityChoice`) che il consumer possa trattare con un\'azione (es. aprire un modal). Regola locked: nessun guard puo\' creare uno stato non-uscibile.',
    },
    // Gate R.5 — Nessun `actionUrl:` con valore literal (stringa hardcoded)
    // per notifiche AI. Il CTA di una notifica AI deriva dal tour costruito
    // dai chosenPois via precompute in Notifications.jsx, non da un URL fisso.
    // Il fallback statico '/explore' faceva sembrare che il bottone funzionasse
    // mentre portava altrove (Gate R diagnosi: notifica cita Savia, bottone
    // apre Explore).
    //
    // Allowlist: DashboardGuide.jsx (notifiche guide-to-user V2, non-AI,
    // fuori path V1 spento da V1LockedGuard). Zero eccezioni in path AI.
    {
        name: 'no-static-action-url-on-ai-notification',
        pattern: /\bactionUrl\s*:\s*["']/,
        allowlist: [
            'src/pages/DashboardGuide.jsx',
        ],
        message: 'actionUrl con valore stringa hardcoded. Le notifiche AI derivano il CTA dal tour costruito dai chosenPois (Notifications.jsx handleVediGiro → /tour-details con state). Se il precompute fallisce, il bottone deve restare disabled — un URL statico e\' un fallback che mente.',
    },
    // Gate Q — Nessun `engineVersion:` come key literal in object literal,
    // ovunque nel repo. Il marker di validita' delle notifiche AI e' una
    // signature opaca calcolata dalla fabbrica (src/lib/aiNotificationFactory.js)
    // usando una key computata `[SIG_KEY]:` — cosi' questa regola blocca
    // qualsiasi push a mano senza eccezioni. La signature deriva da
    // contenuto + salt privato di modulo: chi scrive la key da fuori non
    // conosce il salt e non puo' produrre l'hash corretto.
    //
    // Allowlist: ZERO. La fabbrica usa `[SIG_KEY]:` (computed key), non
    // literal — passa questa regola per costruzione. Se domani qualcuno
    // riscrive la fabbrica con literal `engineVersion:`, deve aggiungere
    // esplicitamente un'eccezione qui e giustificarla in PR review.
    //
    // Regola locked (Ivano 13/07): "un marker di verita' che chiunque puo'
    // scriversi da solo non e' un marker: e' una convenzione".
    {
        name: 'no-engine-version-literal-key',
        pattern: /\bengineVersion\s*:/,
        allowlist: [],
        message: 'engineVersion come key literal in object literal. Il marker e\' una signature opaca calcolata dalla fabbrica (src/lib/aiNotificationFactory.js -> makeAiNotification). Scriverlo a mano bypassa il filtro anti-fake. Se serve un push di notifica AI, chiama makeAiNotification.',
    },
    // Gate 3 T1 — Nessuna chiamata Places puo' essere costruita fuori dalla
    // factory `buildPlacesProxyUrl`. Il builder e' l'UNICO chokepoint: applica
    // `language=it` di default, gli headers proxy, l'edge function di Supabase.
    // Se qualcuno bypassa e fa `fetch('https://.../place/textsearch?...')` a
    // mano, i nomi POI tornano in inglese (Google fallback) + il proxy resta
    // fuori — insieme al fake rientra pure il rischio di leak di API key.
    // Il pattern cattura fetch diretti al Places API (proxy o Google diretto).
    {
        // Gate NARRATORE ANCORATO — FASE A-bis (24/08).
        //
        // Il difetto che questa regola chiude è GIÀ ACCADUTO. Il 22/08 il DIFF 1
        // scrisse fra gli esempi ✓ del prompt: "Entra dalla porta laterale,
        // quella principale è chiusa lun/mar". Il 23/08 il DIFF 3 vietò al
        // narratore di affermare orari di apertura — e non vide quella riga,
        // perché stava cercando ORE e quelli erano GIORNI (lezione #30). Per due
        // giorni un esempio ✓ ha contraddetto la regola che lo precedeva, e un
        // esempio vince sulla regola (lezione #29).
        //
        // Il validatore runtime (Fase B) guarda l'OUTPUT del modello. Nessuno
        // guardava l'INPUT. Questa regola guarda l'input, ed è la forma che
        // sappiamo funzionare: uno scanner sul sorgente.
        //
        // Come distingue ✓ da ✗: il pattern RICHIEDE il ✓ sulla riga. Lo scanner
        // è line-based (vedi scanRule), quindi non serve nessuna euristica e
        // nessuna modifica all'architettura. Le righe ✗ DEVONO contenere le
        // forme vietate — è il loro scopo — e restano esenti per costruzione.
        name: 'no-forbidden-forms-in-prompt-examples',
        pattern: /✓[^\n]*(\b(?:alle|dalle|fino alle)\s*\d|\b(?:lun|mar|mer|gio|ven|sab|dom)\b|\bluned[ìi]\b|\bmarted[ìi]\b|\bmercoled[ìi]\b|\bgioved[ìi]\b|\bvenerd[ìi]\b|\bsabato\b|\bdomenica\b|\bora\b|\badesso\b)/i,
        allowlist: [],
        message: 'Esempio ✓ in un prompt che contiene una forma VIETATA al narratore: un orario con preposizione, un giorno della settimana, o un riferimento al presente. Un esempio ✓ è un template che il modello copia (lezione #27) e vince sulla regola che lo precede (lezione #29). Spostalo fra i ✗, o riscrivilo senza quella forma.',
    },
    {
        // Gate FOTO (15/08) — cercare un luogo per NOME e mostrarne la foto è
        // il bug che ha prodotto "Ippocampo → cortile con ghiaia" e
        // "La Masseria → parco giochi": findPlaceFromQuery({query: "${nome}
        // ${città}"}) restituisce il primo posto che si chiama così, e non c'è
        // modo di verificare che sia lo stesso. La foto va ancorata al
        // place_id (place/details), mai al nome.
        //
        // NON copre getDetails: MapPage.jsx:1424 lo usa con `placeId` esplicito,
        // che è il comportamento corretto ed è fuori perimetro dichiarato.
        //
        // La regex sull'SDK JS colma un buco reale: `no-places-url-outside-builder`
        // qui sotto cerca `fetch(` e `maps.googleapis.com`, quindi non vedeva
        // nessuna delle tre chiamate fatte tramite PlacesService.
        name: 'no-places-sdk-search-by-name',
        pattern: /findPlaceFromQuery/,
        allowlist: [],
        message: 'Ricerca Places per NOME: restituisce "un posto che si chiama così", non questo posto. Usa fetchPlaceDetailsForTour(placeId) + resolvePoiPhoto (src/lib/poiPhoto.js) — la foto si ancora al place_id.',
    },
    {
        name: 'no-places-url-outside-builder',
        pattern: /fetch\s*\(\s*[`'"][^`'"]*place\/(?:textsearch|findplacefromtext|details|photo)|maps\.googleapis\.com\/maps\/api\/place/i,
        allowlist: [],
        message: 'Chiamata Places costruita a mano. Usa buildPlacesProxyUrl({ path: "place/textsearch", ... }) da src/services/aiRecommendationService.js — il builder aggiunge language=it di default e passa dall\'edge function.',
    },
    // Gate EE — Nessun prezzo hardcoded nel copy landing/onboarding/marketing.
    // Bug: la landing mostrava "€49" nello step "Vedi il giro" come se DoveVAI
    // vendesse tour a 49€. V1 non ha prezzi (niente booking, niente marketplace):
    // ogni "€N" nel copy e' una bugia sul modello di business. Il pattern
    // cattura simbolo euro seguito da 1-4 cifre (con eventuali decimali).
    // Escluso: `.price_eur` (nome campo DB, non testo user-visible).
    // Regola locked (Ivano 15/07): "prima la verita', poi la forma. Un prezzo
    // finto e' peggio di un design brutto: dice che l'app fa cose che non fa".
    {
        name: 'no-fake-price-in-copy',
        pattern: /€\s?\d{1,4}(?:[.,]\d{1,2})?(?!\w)/,
        allowlist: [
            // Dead code, non importato da nessun file (pitch deck). Rimuovere in cleanup Blocco 2.
            'src/components/MVPEnhancements.jsx',
        ],
        message: 'Simbolo € seguito da numero nel copy. V1 non ha prezzi (niente booking, niente marketplace). Se un giorno metti prezzi, devono venire dal DB tours.price_eur, non essere hardcoded. Landing/Onboarding: mai in allowlist — vale il muro EE.',
    },
    // Gate EE — Nessun avatar persona fake (randomuser.me, unsplash portraits).
    // Bug: la landing mostrava 3 avatar randomuser.me con testo "+2.800 viaggiatori
    // hanno gia' scoperto DoveVAI" — social proof inventato prima ancora del lancio.
    // Se domani vogliamo social proof veri, saranno avatar da profiles Supabase
    // di utenti reali con consenso. Mai foto stock spacciate per persone reali.
    {
        name: 'no-fake-persona-avatars',
        pattern: /randomuser\.me|unsplash\.com\/(?:photos|portraits)\/[^"'\s]*face|thispersondoesnotexist|generated\.photos/i,
        allowlist: [],
        message: 'Avatar persona da servizio di foto stock/AI-generated. Social proof deve venire da profiles Supabase reali con consenso, o non esistere. La landing NON e\' una vetrina di persone che non esistono.',
    },
    // Gate EE — Nessun numero di social proof scritto nel copy.
    // Bug: la landing diceva "+2.800 viaggiatori" a lancio ancora da fare.
    // Ogni "+N viaggiatori/utenti/clienti/persone" hardcoded e' una bugia sul
    // trazionamento. Se un giorno ci sono utenti veri, il numero deve venire
    // da COUNT(*) di profiles Supabase, non da una stringa scritta a mano.
    {
        name: 'no-fake-social-proof-numbers',
        pattern: /\+?\d{1,3}[.,]?\d{3}\s+(viaggiatori|utenti|clienti|persone|iscritti|scaricamenti|download)/i,
        allowlist: [],
        message: 'Numero di social proof scritto a mano nel copy. Se ci sono utenti veri, il numero deve venire da COUNT su profiles Supabase. Se non ci sono ancora, non mentire.',
    },
    // Gate EE — Nessuna feature V2/V3 nominata come presente nel copy V1.
    // Bug: landing prometteva "guide locali", "esperti certificati", "audioguida",
    // "storie in diretta", "navigazione live", "chatta con la guida" — tutte
    // feature V2/V3 che V1 NON fa. L'utente che clicca Register aspettando
    // guide locali si sente truffato al primo login.
    // Ammesso: gli stessi termini dentro pagine /prossimamente/* (sono la
    // pagina che dichiara ESPLICITAMENTE che la feature non c'e' ancora).
    // GATE CLEANUP: questa nota citava anche `GuidePlaceholder` fra gli ammessi,
    // ma quella pagina non contiene nessun termine V2 — l'esenzione non serviva.
    // Regola locked (Ivano 15/07): "V1 promette solo cio' che V1 mantiene.
    // Le feature V2/V3 vivono in /prossimamente, non nel copy della landing".
    {
        name: 'no-v2-features-in-copy',
        pattern: /\b(guide locali|esperti certificati|audioguida|storie in diretta|navigazione live|chatta con la guida|prenota (?:un|una) guida|booking guida)\b/i,
        allowlist: [
            // Pagine "Prossimamente" — dichiarano ESPLICITAMENTE che la feature
            // non c'e' ancora. Il pattern qui e' onesto, non fake.
            'src/pages/Prossimamente.jsx',
            // GATE CLEANUP — tolta 'src/pages/GuidePlaceholder.jsx': SCADUTA, zero
            // occorrenze di qualunque termine V2 nel file. Il commento del muro EE
            // qui sopra la citava come esenzione necessaria, e non lo era piu'.
            // Attenzione: la pagina NON e' morta ed e' fuori dal perimetro CLEANUP
            // — il suo "Coming Soon" (:30) e' materia del DIFF 6 punto 4.
            // File legacy con copy V2 in path non-Home. Cleanup pianificato Blocco 2:
            //  - TourDetails.jsx:1388 — copy "esplora tour reali delle nostre guide
            //    locali" in ramo tour demo (V2 marketplace, spento in V1).
            //  - AiItinerary.jsx:580 — loading text "L'IA sta consultando le guide
            //    locali" (menzogna operativa: l'IA consulta Google Places, non guide).
            //  - DashboardUser.jsx:877 — conferma guide_request "Le guide locali
            //    su X hanno appena ricevuto la tua ispirazione" (flow V2 dashboard
            //    guide, non nel path Home V1).
            //  - MVPEnhancements.jsx — dead code pitch deck (non importato).
            // Landing.jsx / Onboarding.jsx / Login.jsx MAI in allowlist — vale il muro EE.
            'src/pages/TourDetails.jsx',
            'src/pages/AiItinerary.jsx',
            'src/pages/DashboardUser.jsx',
            'src/components/MVPEnhancements.jsx',
        ],
        message: 'Feature V2/V3 (guide locali, esperti, audioguida, live, chat-guida) nominata come presente nel copy V1. V1 promette solo cio\' che V1 mantiene. Le feature V2/V3 vivono in /prossimamente, non nel copy della landing/onboarding/dashboard. Landing/Onboarding/Login: mai in allowlist — vale il muro EE.',
    },
    // Gate GG (16/07) — Nessun messaggio all'utente puo' affermare
    // un'azione di sistema che non avviene davvero.
    // Bug scoperto Ivano: ErrorBoundary diceva "Il team tecnico e' stato
    // notificato" mentre nel codice c'era solo `console.error()`. Nessuno
    // riceveva niente. Bugia rassicurante, stessa classe di "Marco R." o
    // "Giulia Romano" ma peggio: promette un processo che non esiste.
    //
    // Frasi vietate (in JSX/JS user-facing): affermazioni di azione sistema
    //  - "team (tecnico) (e') stato notificato/avvisato"
    //  - "email inviata / abbiamo inviato l'email"
    //  - "abbiamo salvato" / "salvato con successo" (senza codice che salva)
    // La regola matcha SEMPRE il pattern. Se serve dire una di queste frasi,
    // il file DEVE contenere anche la chiamata che esegue davvero l'azione
    // (`reportError(`, `sendEmail(`, `supabase.from(...).insert`,
    // `supabase.from(...).upsert`). Se il pattern matcha SENZA la call →
    // violazione (bugia rassicurante).
    //
    // Approccio: pattern che catcha la frase; la validation per-file (call
    // presente?) e' fatta nella regola custom sotto (fuori dal loop RULES).
    // Nel loop RULES qui includiamo solo le frasi che NON hanno mai una
    // controparte legittima (rare).
    //
    // Regola locked (Ivano 16/07): "nessun messaggio all'utente puo' affermare
    // un'azione di sistema che non avviene". Test anti-rientro contro le
    // bugie rassicuranti.
    // Nota: questa regola vive nella regola custom sotto
    // `no-reassuring-lie-without-action`, che ha logica per-file necessaria
    // per validare la coesistenza pattern+call.

    // Gate N.0 — Ogni notifica AI-generated deve portare engineVersion.
    // Regola custom: se un file contiene type 'tour_recommendation' o 'weather_alert'
    // deve contenere anche 'engineVersion' (import o uso). Impedisce che un
    // refactor futuro riportando notifiche AI senza marker faccia rientrare
    // testi tipo "Bar Mola" attraverso il filtro.
    // Attiva subito: unica file consumatore è useUserNotifications.js che ora
    // usa la fabbrica makeAiNotification.
];

// Gate N.0 — Regola custom (fuori dal loop RULES perché ha logica per-file
// non pattern grep). Verifica che ogni file che PUBBLICA notifiche AI abbia
// il marker engineVersion nel payload. Filtra i consumers (confronti su n.type,
// switch/case) che non pubblicano.
// Pattern match: `type: 'tour_recommendation'` (assegnazione ad object literal),
// NON `=== 'tour_recommendation'` (confronto/lettura).
// Gate Q — Estesa a 'recommendation' (Buco 1 identificato: il branch night
// deceased usava type:'recommendation' e sfuggiva alla regola). Con Gate Q
// la regola engineVersion-literal e' la vera guardia, questa resta come
// difesa in profondita' — se qualcuno crea AI-notif con type nuovo, la
// nostra grep-based coverage la vede.
const AI_NOTIF_TYPES = /type\s*:\s*["'](tour_recommendation|weather_alert|recommendation)["']/;
const ENGINE_VERSION_TOKEN = /engineVersion/;

// Gate V — Nessun fetch in services/lib/hooks senza AbortController companion.
// Bug scoperto: fetchPlaceDetailsForTour senza timeout appendeva Promise.all
// in generateSystemPrewarmTour, spinner infinito nel modal notifica.
// Regola locked (Ivano 14/07): "ogni stato di loading ha un timeout e una
// via d'uscita". Un await fetch senza signal e' una promise che puo' pendere
// per sempre. Cerchiamo `fetch(` senza `signal` nelle 3 righe circostanti.
const FETCH_CALL = /\bfetch\s*\(/;
const SIGNAL_PRESENT = /\bsignal\s*:|signal\s*\?\s*\{\s*signal\s*\}/;
// Allowlist file legacy con fetch senza timeout — cleanup pianificato
// Blocco 2 (fix strutturale su geocoding/weather/POI legacy). Il path Home
// critico (cityCenter, discoverRealPOIs textsearch, fetchPlaceDetailsForTour,
// fetchPlaceOpeningHours) e' gia' timeout-fixed.
// Gate X: rimossi useEnhancedGeolocation (ipapi + Google Maps geocode +
// Nominatim reverse ora timeout-fixed) e prevista rimozione degli altri
// mano a mano che si fixano. La regola locked (Ivano 14/07): "una fetch
// senza timeout che pende e' la stessa classe di bug dello spinner infinito
// — solo che qui l'utente aspetta senza nemmeno una rotella. L'allowlist
// era debito, e il debito e' appena venuto a bussare".
const FETCH_ALLOWLIST = new Set([
    // Rimasti in allowlist: file V2/V3 spenti (V1LockedGuard) o code path
    // non raggiungibili nel percorso viaggiatore V1. Cleanup Blocco 2.
    'src/services/userContextService.js',      // reverseGeocodeCity Google Maps legacy — Blocco 2
    'src/services/weatherService.js',          // open-meteo weather + geocoding — Blocco 2
    'src/services/poiService.js',              // Overpass API legacy — Blocco 2
    'src/services/dataService.js',             // Nominatim geocoding business fallback (V3) — Blocco 2
    'src/services/aiRecommendationService.js', // verifyPOIWithPlaces legacy (discoverPOIs fallback AI-first) — Blocco 2
]);

// Gate S — Storage key user-derived DEVONO contenere userId.
// Bug scoperto in Gate S diagnosi: cache `dvai_smart_notif_${slot}-${city}-${date}`
// era senza userId → utente B leggeva la notifica di A col nome di A dentro.
// Regola: se una linea contiene una di queste chiavi come literal (string o
// template literal), deve contenere anche un marker userId (`${userId}`,
// `scopedKey(`, `${userId ||`, ecc.). Escludi cleanup helpers
// (`.filter(k => k.startsWith(...))`).
const USER_DERIVED_STORAGE_KEYS = /["'`](dvai_smart_notif_|read_generated_notifs|deleted_generated_notifs)/;
const USER_ID_MARKER = /\$\{[^}]*userId[^}]*\}|scopedKey\s*\(|_\$\{userId|\$\{user\?\.id/;
const CLEANUP_MARKER = /\.filter\s*\(|\.startsWith\s*\(|\.forEach\s*\(/;

// ─── Utility ─────────────────────────────────────────────────────────────────

function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            if (SKIP_DIRS.has(entry)) continue;
            out.push(...walk(full));
            continue;
        }
        if (SKIP_FILE_NAMES.has(entry)) continue;
        if (SKIP_FILE_SUFFIXES.some(s => entry.endsWith(s))) continue;
        const ext = entry.slice(entry.lastIndexOf('.'));
        if (!SCAN_EXTENSIONS.has(ext)) continue;
        out.push(full);
    }
    return out;
}

function isAllowlisted(relativePath, allowlist) {
    return allowlist.some(a => relativePath === a || relativePath.replace(/\\/g, '/') === a);
}

function scanRule(rule, files) {
    const violations = [];
    for (const file of files) {
        const rel = relative(REPO_ROOT, file).replace(/\\/g, '/');
        if (isAllowlisted(rel, rule.allowlist)) continue;
        const content = readFileSync(file, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            // Skippa commenti dedicati: qualsiasi linea che INIZIA con //
            // o che è dentro un blocco /* … */ (heuristic: linea che ha // Gate…
            // dopo un pattern è tollerata, ma commenti puri no).
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
            if (rule.pattern.test(line)) {
                violations.push({ file: rel, line: idx + 1, content: line.trim().slice(0, 200) });
            }
        });
    }
    return violations;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Gate M — Anti-fake test', () => {
    const files = walk(SRC_ROOT);

    for (const rule of RULES) {
        const testFn = rule.skip ? it.skip : it;
        testFn(`[${rule.name}] ${rule.message}`, () => {
            const violations = scanRule(rule, files);
            if (violations.length > 0) {
                const details = violations
                    .map(v => `  ${v.file}:${v.line} → ${v.content}`)
                    .join('\n');
                const allowNote = rule.allowlist.length > 0
                    ? `\nAllowlist: ${rule.allowlist.join(', ')}`
                    : '\nAllowlist vuota.';
                throw new Error(
                    `${rule.name}: ${violations.length} violazione/i (${rule.message})\n${details}${allowNote}\n` +
                    `Fix: rimuovi il pattern OPPURE giustifica il file aggiungendolo all'allowlist della regola.`
                );
            }
            expect(violations).toHaveLength(0);
        });
    }

    // Gate V — Regola attiva, per-linea: nessun `fetch(` senza AbortController
    // companion (`signal:` nelle 3 righe circostanti). Scope: file services/lib/hooks.
    // Files legacy con fetch senza timeout in allowlist FETCH_ALLOWLIST — cleanup
    // Blocco 2. Il path Home critico (cityCenter, placesDiscovery textsearch/details/
    // openingHours/photo) e' gia' timeout-fixed dopo Gate V — se qualcuno aggiunge
    // una nuova fetch senza signal in placesDiscoveryService.js, la CI la vede.
    it('[no-fetch-without-abort-signal] fetch() nei services deve avere AbortController', () => {
        const missing = [];
        for (const file of files) {
            const rel = relative(REPO_ROOT, file).replace(/\\/g, '/');
            if (!(rel.startsWith('src/services/') || rel.startsWith('src/lib/') || rel.startsWith('src/hooks/') || rel.startsWith('src/context/'))) continue;
            if (FETCH_ALLOWLIST.has(rel)) continue;
            const content = readFileSync(file, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                const t = line.trim();
                if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
                if (!FETCH_CALL.test(line)) return;
                // Cerca signal in finestra +8 righe (fetch multi-line con opts
                // che possono estendersi oltre 3 righe, es. body multi-line +
                // signal in fondo all'options object).
                const start = Math.max(0, idx - 1);
                const end = Math.min(lines.length, idx + 8);
                const chunk = lines.slice(start, end).join(' ');
                if (SIGNAL_PRESENT.test(chunk)) return;
                missing.push({ file: rel, line: idx + 1, content: t.slice(0, 200) });
            });
        }
        if (missing.length > 0) {
            const details = missing.map(v => `  ${v.file}:${v.line} → ${v.content}`).join('\n');
            throw new Error(
                `no-fetch-without-abort-signal: ${missing.length} violazione/i.\n${details}\n` +
                `Fix: usa AbortController con timeout 5s (Places/GPS) o 12s+ (OpenAI). Esempio:\n` +
                `  const ctrl = new AbortController();\n  const tid = setTimeout(() => ctrl.abort(), 5000);\n  try { await fetch(url, { signal: ctrl.signal }); clearTimeout(tid); ... } catch { clearTimeout(tid); ... }\n` +
                `Se il file e' legacy e cleanup pianificato Blocco 2, aggiungi a FETCH_ALLOWLIST con nota TODO.`
            );
        }
        expect(missing).toHaveLength(0);
    });

    // Gate S — Regola attiva, per-linea: se una linea contiene una chiave
    // storage user-derived come literal (`dvai_smart_notif_*`,
    // `read_generated_notifs`, `deleted_generated_notifs`), deve contenere
    // anche un marker userId (`${userId}`, `scopedKey(`, `_${userId`).
    // Escludi cleanup helpers (`.filter(k=>k.startsWith(...))`,
    // `.forEach(k=>...removeItem(k))`) usati in signOut per rimuovere tutte
    // le varianti prefixed.
    it('[no-user-derived-storage-key-without-userid] Storage key user-derived devono avere userId', () => {
        const missing = [];
        for (const file of files) {
            const rel = relative(REPO_ROOT, file).replace(/\\/g, '/');
            const content = readFileSync(file, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
                if (!USER_DERIVED_STORAGE_KEYS.test(line)) return;
                if (CLEANUP_MARKER.test(line)) return; // filter/startsWith/forEach cleanup
                if (USER_ID_MARKER.test(line)) return;
                missing.push({ file: rel, line: idx + 1, content: trimmed.slice(0, 200) });
            });
        }
        if (missing.length > 0) {
            const details = missing.map(v => `  ${v.file}:${v.line} → ${v.content}`).join('\n');
            throw new Error(
                `no-user-derived-storage-key-without-userid: ${missing.length} violazione/i.\n${details}\n` +
                `Fix: le chiavi dvai_smart_notif_/read_generated_notifs/deleted_generated_notifs devono avere lo userId nel key path. Usa scopedKey('base') o \`\${base}_\${userId || 'guest'}\`.`
            );
        }
        expect(missing).toHaveLength(0);
    });

    // Gate GG (16/07) — Regola attiva, custom: nessuna frase user-facing puo'
    // affermare un'azione di sistema (notifica al team / email inviata /
    // dato salvato) senza che il codice di quel file la esegua davvero.
    //
    // Bug scoperto Ivano: ErrorBoundary diceva "Il team tecnico e' stato
    // notificato" mentre componentDidCatch faceva solo console.error.
    // Nessuno riceveva niente. Bugia rassicurante.
    //
    // Pattern: qualunque literal string (JSX/JS) che matcha frasi tipo
    // "team ... notificato", "email inviata", "abbiamo salvato". Se la
    // frase c'e', il file DEVE contenere anche una call verificabile che
    // realizza l'azione: reportError(, sendEmail(, supabase.from(...).insert,
    // supabase.from(...).upsert, oppure un helper di test/mock evidente.
    //
    // Regola locked (Ivano 16/07): "nessun messaggio all'utente puo' affermare
    // un'azione di sistema che non avviene". Vale anche per copy che
    // riguarda percorsi non-error (successo booking, invito inviato, ecc).
    it('[no-reassuring-lie-without-action] Frasi tipo "team notificato / email inviata / salvato" richiedono il codice che esegue davvero l\'azione', () => {
        const REASSURING_PHRASES = /\b(team\s+(?:tecnico\s+)?(?:e['’])?\s*stato\s+(?:notificato|avvisato)|(?:e['’])\s+stato\s+notificato|abbiamo\s+notificato|email\s+inviata|abbiamo\s+inviato\s+l['’]?email|abbiamo\s+salvato|salvato\s+con\s+successo)\b/i;
        const ACTION_MARKERS = /\breportError\s*\(|\bsendEmail\s*\(|\bmailto\s*:|supabase\.[a-zA-Z_]+\([^)]*\)\.(?:insert|upsert|update)|\bfrom\s*\(\s*["'][^"']*["']\s*\)\s*\.(?:insert|upsert|update)|\berror_logs\b/;
        const missing = [];
        for (const file of files) {
            const rel = relative(REPO_ROOT, file).replace(/\\/g, '/');
            const content = readFileSync(file, 'utf8');
            if (!REASSURING_PHRASES.test(content)) continue;
            if (ACTION_MARKERS.test(content)) continue;
            // Riporta la linea specifica per messaggio piu' utile.
            const lines = content.split('\n');
            const idx = lines.findIndex(l => REASSURING_PHRASES.test(l) && !l.trim().startsWith('//') && !l.trim().startsWith('*'));
            if (idx < 0) continue; // era in commento puro
            missing.push({ file: rel, line: idx + 1, content: lines[idx].trim().slice(0, 200) });
        }
        if (missing.length > 0) {
            const details = missing.map(v => `  ${v.file}:${v.line} → ${v.content}`).join('\n');
            throw new Error(
                `no-reassuring-lie-without-action: ${missing.length} violazione/i.\n${details}\n` +
                `Fix: se la frase "team notificato / email inviata / salvato" appare in un file, quel file deve contenere anche una call che esegue davvero l'azione (reportError(, sendEmail(, supabase.from(...).insert/upsert). Oppure togli la frase.`
            );
        }
        expect(missing).toHaveLength(0);
    });

    // Gate N.0 — Regola attiva, custom: se un file contiene push di notifica AI
    // (type 'tour_recommendation' o 'weather_alert') deve contenere anche
    // 'engineVersion' — testimonianza che la notifica porta il marker versione.
    it('[no-ai-notif-without-engine-version] Notifiche AI (tour_recommendation/weather_alert) devono avere engineVersion nel payload', () => {
        const missing = [];
        for (const file of files) {
            const rel = relative(REPO_ROOT, file).replace(/\\/g, '/');
            const content = readFileSync(file, 'utf8');
            if (AI_NOTIF_TYPES.test(content) && !ENGINE_VERSION_TOKEN.test(content)) {
                missing.push(rel);
            }
        }
        if (missing.length > 0) {
            throw new Error(
                `no-ai-notif-without-engine-version: ${missing.length} file(s) pubblicano notifiche AI senza engineVersion:\n` +
                missing.map(f => `  ${f}`).join('\n') + '\n' +
                `Fix: usa makeAiNotification() da src/hooks/useUserNotifications.js OPPURE aggiungi engineVersion: NOTIFICATION_ENGINE_VERSION al payload.`
            );
        }
        expect(missing).toHaveLength(0);
    });
});
