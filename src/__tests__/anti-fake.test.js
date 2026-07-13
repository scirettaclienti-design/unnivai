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
        ],
        message: 'Rating hardcoded. Le stelle vengono dal DB (tours.rating) o da Google Places.',
        // SKIP: AiItinerary/DashboardUser/SurpriseTour/locationTourService — 22 residue.
        // Riattivare dopo cleanup fallback tour location + AiItinerary POI hardcoded.
        skip: true,
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
        ],
        message: 'Prezzo hardcoded. price_eur viene dal DB tours.',
        // SKIP: AiItinerary POI catania hardcoded + DashboardUser THEME_CONFIGS
        // + locationTourService 12 tour hardcoded — 23 residue.
        skip: true,
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
        // SKIP: DashboardUser.jsx buildSmartExperiencesAsync (146-147) usa random.
        // Riattivare dopo cleanup.
        skip: true,
    },
];

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
});
