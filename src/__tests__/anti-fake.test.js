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
            'src/services/tourShape.js',
            'src/pages/QuickPath.jsx',
            'src/services/aiRecommendationService.js',
            'src/services/placesDiscoveryService.js',
            // Gate O.2: allowlist per file NON in path Home. Rating fake residuo,
            // cleanup pianificato in Blocco 2.2/2.3 (AiItinerary/SurpriseTour →
            // via location tour manager; locationTourService → tour reali DB).
            'src/pages/AiItinerary.jsx',
            'src/pages/SurpriseTour.jsx',
            'src/services/locationTourService.js',
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
        allowlist: [
            'src/pages/QuickPath.jsx',
            // Gate O.2: allowlist non-Home. Cleanup pianificato Blocco 2.2/2.3.
            'src/pages/AiItinerary.jsx',
            'src/services/locationTourService.js',
        ],
        message: 'Prezzo hardcoded. price_eur viene dal DB tours.',
    },
    {
        name: 'no-fake-reviewer-names',
        pattern: /\b(Maria Benedetti|Giuseppe Torrisi|Andrea Morosini|Sofia|Marco R|Elena|Luca|Giulia)\b/,
        allowlist: [],
        message: 'Nome persona fake. Reviewer/guide/participants devono venire da profiles DB.',
        // SKIP: GroupInviteModal.jsx (V2 group feature, mai raggiunto ma nel repo)
        // + Landing.jsx (Giulia demo marketing showcase — decide Ivano se mock è OK per marketing)
        // + TourDetails.jsx:950 (falso positivo: è dentro un commento JSX Gate K).
        skip: true,
    },
    {
        name: 'no-luogo-di-interesse-placeholder',
        pattern: /Luogo di interesse|Punto d['´]?interesse consigliato/i,
        allowlist: [],
        message: 'Segnaposto placeholder. Usa description reale da Google Places o empty state onesto.',
        // SKIP: POIDetailDrawer/MapPage hanno GUARD (`description !== "Punto..."`) che
        // NON mostrano il segnaposto — sono corretti. DashboardUser:106 sì problematico.
        // Riattivare dopo cleanup DashboardUser buildSmartExperiencesAsync description.
        skip: true,
    },
    {
        name: 'no-unsplash-in-content',
        pattern: /images\.unsplash\.com/,
        allowlist: [
            'src/utils/imageUtils.js',
            'src/pages/Landing.jsx',
            'src/pages/QuickPath.jsx',
            'src/pages/SurpriseTour.jsx',
            'src/pages/AiItinerary.jsx',
            'src/services/locationTourService.js',
        ],
        message: 'Unsplash dentro contenuto tour. Le foto vengono da Google Places photo API.',
        // SKIP: Profile.jsx region cover + dataService fallback + tourShape STEP_FALLBACK
        // + GroupInviteModal Sofia avatar. Riattivare dopo cleanup Profile regioni +
        // sostituzione STEP_FALLBACK con categoryPalette.
        skip: true,
    },
    {
        name: 'no-roma-coords-in-tour-content',
        pattern: /\b(41\.9028|12\.4964)\b/,
        allowlist: [
            'src/components/Map/GoogleMapContainer.jsx',
            'src/hooks/useEnhancedGeolocation.js',
            'src/services/userContextService.js',
            'src/pages/DashboardUser.jsx',
            'src/pages/Explore.jsx',
            'src/pages/Login.jsx',
            'src/pages/guide/TourBuilder.jsx',
            'src/data/demoData.js',
            'src/services/aiRecommendationService.js',
        ],
        message: 'Coord Roma inline. I tour usano coord reali da Google Places, non 41.9028/12.4964.',
        // Attiva subito: tutti i posti sono in allowlist per default tecnici.
    },
    {
        name: 'no-in-arrivo-toast',
        pattern: /(Funzione in arrivo|Funzionalità in arrivo|Coming soon)/i,
        allowlist: [],
        message: 'Toast "in arrivo" al posto della vera funzione. Se non esiste, non mostrare il bottone.',
        // SKIP: GuidePlaceholder.jsx:30 ("Coming Soon" pagina placeholder V2/V3)
        // + TourDetails.jsx:809 (toast chat-guida "in arrivo"). Da fixare in un
        // Gate futuro: eliminare il bottone chat-guida e la pagina GuidePlaceholder.
        skip: true,
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
        pattern: /\|\|\s*["']Roma["']|\bcity\s*[:=]\s*["']Roma["']|\btemperatureC\s*:\s*\d+/,
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
            // Cleanup pianificato Blocco 2.2 (Profilo reale) / 2.3 (Esplora + TourLive).
            'src/pages/TourLive.jsx',
            'src/pages/Profile.jsx',
            'src/pages/Explore.jsx',
        ],
        message: 'Rating/reviews a livello TOUR nel JSX. Solo POI-level: usa exp.featuredPoi.rating o step.rating, mai un aggregato inventato del tour.',
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
        name: 'no-places-url-outside-builder',
        pattern: /fetch\s*\(\s*[`'"][^`'"]*place\/(?:textsearch|findplacefromtext|details|photo)|maps\.googleapis\.com\/maps\/api\/place/i,
        allowlist: [],
        message: 'Chiamata Places costruita a mano. Usa buildPlacesProxyUrl({ path: "place/textsearch", ... }) da src/services/aiRecommendationService.js — il builder aggiunge language=it di default e passa dall\'edge function.',
    },
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
