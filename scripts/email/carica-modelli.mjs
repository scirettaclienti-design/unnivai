#!/usr/bin/env node
// EMAIL-LANCIO — carica in Supabase Auth i tre modelli del repo (conferma, link di accesso, reset della password)
// con la Management API: PATCH /v1/projects/{ref}/config/auth. Tocca SOLO i 6 campi dei tre modelli
// (mailer_subjects_* e mailer_templates_*_content): SMTP, Site URL, redirect e rate limit restano come sono.
//
//   node scripts/email/carica-modelli.mjs            prova: mostra cosa cambierebbe rispetto a produzione (nessuna scrittura)
//   node scripts/email/carica-modelli.mjs --invia    scrive, poi rilegge e controlla che i 6 campi siano uguali ai file
//
// Serve SUPABASE_ACCESS_TOKEN nell'ambiente (token personale da supabase.com/dashboard/account/tokens).
// Il token non si stampa mai. Progetto: SUPABASE_PROJECT_REF, di difetto ahecpiwsdhghkndncejb.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = path.join(root, 'supabase/templates');
const REF = process.env.SUPABASE_PROJECT_REF || 'ahecpiwsdhghkndncejb';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';
const INVIA = process.argv.includes('--invia');

export function corpoPatch(cartella = dir) {
    const soggetti = JSON.parse(fs.readFileSync(path.join(cartella, 'soggetti.json'), 'utf8'));
    const corpo = {};
    for (const [chiave, { file, oggetto }] of Object.entries(soggetti)) {
        corpo[`mailer_subjects_${chiave}`] = oggetto;
        corpo[`mailer_templates_${chiave}_content`] = fs.readFileSync(path.join(cartella, file), 'utf8');
    }
    return corpo;
}

async function api(metodo, corpo) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
        method: metodo,
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (!r.ok) throw new Error(`${metodo} config/auth: HTTP ${r.status}`);
    return r.json();
}

async function main() {
    const corpo = corpoPatch();
    if (!TOKEN) {
        console.log('Manca SUPABASE_ACCESS_TOKEN: mostro solo i campi che verrebbero scritti.');
        for (const [k, v] of Object.entries(corpo)) console.log(`  ${k}: ${v.length} caratteri`);
        process.exit(INVIA ? 1 : 0);
    }
    const prima = await api('GET');
    for (const [k, v] of Object.entries(corpo)) {
        console.log(`  ${k}: ${prima[k] === v ? 'già uguale' : `cambia (${String(prima[k] ?? '').length} → ${v.length} caratteri)`}`);
    }
    if (!INVIA) { console.log('Prova: niente scritto. Per scrivere: --invia'); return; }
    await api('PATCH', corpo);
    const dopo = await api('GET');
    const diversi = Object.keys(corpo).filter((k) => dopo[k] !== corpo[k]);
    if (diversi.length) { console.error(`Dopo la scrittura non coincidono: ${diversi.join(', ')}`); process.exit(1); }
    console.log(`Scritti e riletti: ${Object.keys(corpo).length} campi uguali ai file del repo.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((e) => { console.error(e.message); process.exit(1); });
}
