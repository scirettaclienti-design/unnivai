#!/usr/bin/env node
// T29 — l'audit del DNA a 0 $: storia finta, pesi veri, giro rigiocato. Scrive il json e il grafico accanto al report.
import { spawnSync } from 'node:child_process';
const OUT = process.argv[2] || 'docs/prove/dati/impostazioni-verifica/dna-audit.json';
const SVG = process.argv[3] || 'docs/prove/img/2026-11-07-impostazioni-verifica/dna-audit.svg';
const r = spawnSync('npx', ['vitest', 'run', '-c', 'scripts/impostazioni/vitest.dna.config.js'], { stdio: 'ignore', env: { ...process.env, DNA_OUT: OUT } });
if (r.status) process.exit(r.status);
spawnSync('node', ['scripts/impostazioni/grafico-dna.mjs', OUT, SVG], { stdio: 'inherit' });
