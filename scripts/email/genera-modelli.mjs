#!/usr/bin/env node
// EMAIL-LANCIO — rigenera supabase/templates/*.html e soggetti.json dalla fonte unica
// supabase/functions/_shared/emailUnnivai.ts. Nessuna rete.
//
//   node --experimental-strip-types scripts/email/genera-modelli.mjs
//
// Il test src/__tests__/email/modelliEmail.test.js controlla che i file nel repo siano uguali a quelli generati.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { MODELLI_AUTH } = await import(path.join(root, 'supabase/functions/_shared/emailUnnivai.ts'));
const dir = path.join(root, 'supabase/templates');
fs.mkdirSync(dir, { recursive: true });
const soggetti = {};
for (const [chiave, m] of Object.entries(MODELLI_AUTH)) {
    fs.writeFileSync(path.join(dir, m.file), m.html);
    soggetti[chiave] = { file: m.file, oggetto: m.oggetto };
    console.log(`${chiave.padEnd(13)} → supabase/templates/${m.file} (${m.html.length} caratteri) · «${m.oggetto}»`);
}
fs.writeFileSync(path.join(dir, 'soggetti.json'), JSON.stringify(soggetti, null, 2) + '\n');
console.log('soggetti     → supabase/templates/soggetti.json');
