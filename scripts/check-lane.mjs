#!/usr/bin/env node
/**
 * PAR-0 — la guardia della corsia estetica.
 *
 * Sui branch `estetica/*` confronta i file cambiati con origin/main (dal punto
 * in cui il branch si e' staccato) e fallisce se anche uno solo e' fuori
 * dall'elenco dei percorsi ammessi. Sugli altri branch non fa nulla.
 *
 * L'elenco e' qui e in docs/PARALLELO.md, con le stesse righe: chi cambia uno
 * dei due cambia anche l'altro (lo controlla src/__tests__/scripts/checkLane.test.js).
 * Questo file sta in scripts/, che la corsia estetica non puo' toccare; la CI
 * lo esegue nella versione di origin/main, non in quella del branch.
 *
 * PAR-1 — permessi per branch. docs/corsia-e-permessi.json (letto SEMPRE da
 * origin/main, mai dal branch) concede a un branch estetica/<nome> anche altri
 * file: { "estetica/<nome>": { "files": [...], "dal": "AAAA-MM-GG", "motivo": "..." } }.
 * Un branch non elencato ha solo l'elenco base. Nei .jsx (base o concessi) la
 * guardia legge le righe AGGIUNTE: niente import da services, lib, hooks,
 * store, context; niente fetch, supabase; niente useState/useEffect/useReducer/
 * useContext nuovi. "Nuovi" = piu' presenze nelle righe aggiunte che in quelle
 * tolte: ritoccare la classe di una riga che gia' conteneva useState passa.
 * Gli import di icone (lucide-react) sono ammessi.
 *
 * Uso: node scripts/check-lane.mjs [branch] [base]
 *   branch: di default GITHUB_HEAD_REF, poi GITHUB_REF_NAME, poi il branch attuale
 *   base:   di default origin/main
 */

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const LANE_PREFIX = 'estetica/';

// I percorsi ammessi per la corsia estetica: solo stile, icone e componenti
// puramente grafici (nessun import da services, lib, hooks, context, store,
// nessuna rete, nessuno stato, nessuna navigazione).
export const ALLOWED_PATHS = [
    // stile
    'src/index.css',
    'src/components/**/*.css',
    'src/pages/*.css',
    'src/styles/themeTokens.js',
    // icone e immagini
    'src/assets/**/*.{svg,png,jpg,jpeg,webp,avif,gif,ico}',
    'public/**/*.{svg,png,jpg,jpeg,webp,avif,gif,ico}',
    // componenti puramente grafici
    'src/components/PromotionalBanner.jsx',
    'src/components/MVPEnhancements.jsx',
    'src/components/Map/AIAskButton.jsx',
    'src/components/Map/GeminiAskButton.jsx',
    'src/components/Map/VehicleSelectionDrawer.jsx',
];

// Glob minimo: `**/` = zero o piu' cartelle, `*` = un pezzo di nome senza `/`,
// `{a,b}` = alternative. Niente altro.
const globToRegExp = (glob) => {
    let re = '';
    for (let i = 0; i < glob.length; i += 1) {
        const ch = glob[i];
        if (glob.startsWith('**/', i)) { re += '(?:[^/]+/)*'; i += 2; }
        else if (ch === '*') re += '[^/]*';
        else if (ch === '{') { const end = glob.indexOf('}', i); re += `(?:${glob.slice(i + 1, end).split(',').map(s => s.replace(/[.+?^$()|[\]\\]/g, '\\$&')).join('|')})`; i = end; }
        else re += ch.replace(/[.+?^$()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${re}$`);
};
const ALLOWED_RES = ALLOWED_PATHS.map(globToRegExp);

export const isAllowedPath = (file) => ALLOWED_RES.some(re => re.test(file));

export const PERMISSIONS_FILE = 'docs/corsia-e-permessi.json';

/** I file concessi a un branch dal file dei permessi (oggetto gia' letto). */
export const grantedFiles = (permessi, branch) => {
    const voce = permessi && typeof permessi === 'object' ? permessi[branch] : null;
    return Array.isArray(voce?.files) ? voce.files.filter(f => typeof f === 'string') : [];
};

// Le regole sulle righe aggiunte dei .jsx: [nome, regex globale].
const IMPORT_FROM = (dir) => new RegExp(String.raw`\b(?:import|from)\b[^\n]*['"](?:@/|(?:\.\.?/)+)(?:[^'"]*/)?${dir}(?:/|['"])`, 'g');
export const JSX_RULES = [
    ['import da services', IMPORT_FROM('services')],
    ['import da lib', IMPORT_FROM('lib')],
    ['import da hooks', IMPORT_FROM('hooks')],
    ['import da store', IMPORT_FROM('store')],
    ['import da context', IMPORT_FROM('context')],
    ['fetch', /\bfetch\s*\(/g],
    ['supabase', /supabase/gi],
    ['useState', /\buseState\b/g],
    ['useEffect', /\buseEffect\b/g],
    ['useReducer', /\buseReducer\b/g],
    ['useContext', /\buseContext\b/g],
];
const count = (lines, re) => lines.reduce((n, l) => n + (l.match(re) || []).length, 0);

/** Le regole violate dalle righe aggiunte di un .jsx (vuoto = solo aspetto). */
export function jsxViolations({ added = [], removed = [] }) {
    return JSX_RULES.filter(([, re]) => count(added, re) > count(removed, re)).map(([nome]) => nome);
}

/**
 * @param {{ branch: string, files: string[], permessi?: object,
 *   diffs?: Record<string, { added: string[], removed: string[] }> }} p
 * @returns {{ checked: boolean, outside: string[], granted: string[],
 *   logic: Array<{ file: string, regole: string[] }> }}
 */
export function checkLane({ branch, files, permessi = {}, diffs = {} }) {
    if (!String(branch || '').startsWith(LANE_PREFIX)) return { checked: false, outside: [], granted: [], logic: [] };
    const granted = grantedFiles(permessi, branch);
    const ok = (f) => isAllowedPath(f) || granted.includes(f);
    const list = (files || []).filter(Boolean);
    const logic = list.filter(f => ok(f) && f.endsWith('.jsx'))
        .map(f => ({ file: f, regole: jsxViolations(diffs[f] || {}) }))
        .filter(x => x.regole.length > 0);
    return { checked: true, outside: list.filter(f => !ok(f)), granted, logic };
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function main() {
    const branch = process.argv[2] || process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || git('rev-parse', '--abbrev-ref', 'HEAD');
    if (!branch.startsWith(LANE_PREFIX)) {
        console.log(`[check-lane] ${branch}: non e' un branch ${LANE_PREFIX}*, niente da controllare.`);
        return 0;
    }
    const base = process.argv[3] || 'origin/main';
    // --no-renames: un file spostato conta due volte (vecchio e nuovo percorso),
    // cosi' spostare un servizio dentro una cartella ammessa non passa.
    const files = git('diff', '--name-only', '--no-renames', `${base}...HEAD`).split('\n').filter(Boolean);
    // I permessi si leggono da origin/main: un branch non puo' concedersi file da solo.
    let permessi = {};
    try { permessi = JSON.parse(git('show', `${base}:${PERMISSIONS_FILE}`)); }
    catch (e) { console.log(`[check-lane] ${PERMISSIONS_FILE} non leggibile da ${base} (${e.message.split('\n')[0]}): solo l'elenco base.`); }
    const diffs = {};
    for (const f of files.filter(x => x.endsWith('.jsx'))) {
        const lines = git('diff', '-U0', '--no-renames', `${base}...HEAD`, '--', f).split('\n');
        diffs[f] = {
            added: lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.slice(1)),
            removed: lines.filter(l => l.startsWith('-') && !l.startsWith('---')).map(l => l.slice(1)),
        };
    }
    const { outside, granted, logic } = checkLane({ branch, files, permessi, diffs });
    if (granted.length) console.log(`[check-lane] ${branch}: file concessi da ${PERMISSIONS_FILE}: ${granted.join(', ')}`);
    if (outside.length === 0 && logic.length === 0) {
        console.log(`[check-lane] ${branch}: ${files.length} file cambiati, tutti nella corsia estetica.`);
        return 0;
    }
    if (outside.length) {
        console.error(`[check-lane] ${branch}: ${outside.length} file FUORI dalla corsia estetica:`);
        for (const f of outside) console.error(`  ✗ ${f}`);
    }
    if (logic.length) {
        console.error(`[check-lane] ${branch}: righe aggiunte che non sono solo aspetto:`);
        for (const { file, regole } of logic) console.error(`  ✗ ${file}: ${regole.join(', ')}`);
    }
    console.error(`[check-lane] Percorsi ammessi: docs/PARALLELO.md; permessi per branch: ${PERMISSIONS_FILE}. Il resto lo cambia solo Claude Code, su main.`);
    return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
