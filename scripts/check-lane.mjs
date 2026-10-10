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

/**
 * @param {{ branch: string, files: string[] }} p
 * @returns {{ checked: boolean, outside: string[] }}
 */
export function checkLane({ branch, files }) {
    if (!String(branch || '').startsWith(LANE_PREFIX)) return { checked: false, outside: [] };
    return { checked: true, outside: (files || []).filter(f => f && !isAllowedPath(f)) };
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
    const { outside } = checkLane({ branch, files });
    if (outside.length === 0) {
        console.log(`[check-lane] ${branch}: ${files.length} file cambiati, tutti nella corsia estetica.`);
        return 0;
    }
    console.error(`[check-lane] ${branch}: ${outside.length} file FUORI dalla corsia estetica:`);
    for (const f of outside) console.error(`  ✗ ${f}`);
    console.error('[check-lane] Percorsi ammessi: docs/PARALLELO.md. Questi file li cambia solo Claude Code, su main.');
    return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
