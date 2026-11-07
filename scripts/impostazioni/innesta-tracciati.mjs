#!/usr/bin/env node
// T29 — sostituisce in un file di tracciati i soli casi rifatti da un giro vero: dopo una modifica che cambia le richieste di pochi casi non
// serve ripagare tutta la guardia. node scripts/impostazioni/innesta-tracciati.mjs <destinazione.json.gz> <sorgente.json.gz> caso1,caso2
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
const [, , DEST, SORG, CASI] = process.argv;
const leggi = (f) => JSON.parse(gunzipSync(readFileSync(f)).toString('utf8'));
const d = leggi(DEST), s = leggi(SORG);
for (const id of CASI.split(',')) {
    const nuovo = s.casi.find(c => c.id === id);
    const i = d.casi.findIndex(c => c.id === id);
    if (!nuovo || i < 0) throw new Error(`caso ${id} mancante`);
    d.casi[i] = nuovo;
    console.log(`innestato ${id}`);
}
d.innesti = [...(d.innesti || []), { casi: CASI.split(','), da: s.registrato, commit: s.commit }];
writeFileSync(DEST, gzipSync(JSON.stringify(d)));
