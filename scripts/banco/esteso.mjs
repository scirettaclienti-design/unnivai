#!/usr/bin/env node
// BANCO-ESTESO — il comando unico: genera la matrice, rilancia ONB-1 (classe 9),
// applica i controlli e scrive il report.
//
//   npm run banco:esteso                       tutti i casi, poi ONB-1, poi il report
//   BANCO_CASI=veloce-catania-relax-2125 npm run banco:esteso
//   npm run banco:esteso -- --report <file.json>   solo il report da un giro gia' fatto
//
// Scrive docs/prove/dati/AAAA-MM-GG-banco-esteso.json (grezzo, con il pool di ogni
// momento) e docs/prove/AAAA-MM-GG-banco-esteso.md. Se esiste
// docs/prove/dati/<nome>-note.md lo accoda al report (appendici scritte a mano).
import { spawnSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildReportEsteso } from './report-esteso.js';
import { confrontoPlaces } from './confronto-places.js';
import { reportOrari } from './report-orari.js';
import { reportC6a } from './report-c6a.js';
import { reportFestivi } from './report-festivi.js';
import { reportContinuita } from './report-continuita.js';
import { reportComposizione } from './report-composizione.js';
import { reportSera } from './report-sera.js';
import { reportPasti, unisciGrezzi as unisciPasti } from './report-pasti.js';
import { reportMinimi, unisciGrezzi } from './report-minimi.js';
import { reportTesti } from './report-testi.js';

const root = process.cwd();
const config = JSON.parse(readFileSync(path.join(root, 'scripts/banco/banco.config.json'), 'utf8'));
// BANCO_DATA=AAAA-MM-GG: il nome dei file del giro (default: oggi a Roma). Serve a dare al report il nome del task.
const oggi = process.env.BANCO_DATA || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
const git = (cmd) => { try { return execSync(`git ${cmd}`, { cwd: root }).toString().trim(); } catch { return null; } };
const commit = `${git('rev-parse --short HEAD') || '?'}${git('status --porcelain -- src') ? ' (con modifiche locali in src/)' : ''}`;

const NUOVA = process.env.BANCO_PLACES === 'new';
// ORARI — BANCO_RUN=orari: lo stesso giro con la regola degli orari; il report confronta con il giro `new` di prima della regola.
const ORARI = process.env.BANCO_RUN === 'orari';
// C6a — BANCO_RUN=c6a: lo stesso giro con famiglie, durate e nomi dal tipo principale; il report confronta con il giro ORARI.
const C6A = process.env.BANCO_RUN === 'c6a';
// ORARI-FESTIVI — BANCO_RUN=festivi: gli orari del giorno (festivi, ferie); il report confronta con il giro C6a.
const FESTIVI = process.env.BANCO_RUN === 'festivi';
// CONTINUITA' — BANCO_RUN=continuita: buchi riempiti o dichiarati; il report confronta con il giro C6a (stessi casi, stesso giorno).
const CONTINUITA = process.env.BANCO_RUN === 'continuita';
// C7 — BANCO_RUN=composizione: il tema cibo solo nei pasti, un pasto per fascia, niente zone; il report confronta con il giro CONTINUITA'.
const COMPOSIZIONE = process.env.BANCO_RUN === 'composizione';
// C8a — BANCO_RUN=sera: la sera e il Veloce (aperitivo da 45 minuti, passeggiata, Veloce da 18:00, scheletro mai vuoto); il report confronta con i giri di prima degli stessi casi.
// BANCO_RUN=sera-prima: gli stessi casi sul codice di PRIMA (ce135b5), per i casi che non erano in nessun giro.
const SERA = process.env.BANCO_RUN === 'sera';
const SERA_PRIMA = process.env.BANCO_RUN === 'sera-prima';
// C8b — BANCO_RUN=minimi: minimi di tappe, cena tardi, Per Te nelle sue ore. Piu' file nello stesso task (il tetto e' del task):
// `--report a.json,b.json,c.json` li unisce; ogni giro nuovo scrive `-minimi`, `-minimi-2`, ...
const MINIMI = process.env.BANCO_RUN === 'minimi';
// C8c — BANCO_RUN=pasti: la sera si cena, la colazione chiesta, un dolce solo e dopo. Piu' file nello stesso task (il tetto e' del task):
// `--report a.json,b.json` li unisce; il "prima" e' il giro di C8b dello stesso caso.
const PASTI = process.env.BANCO_RUN === 'pasti';
// C8d — BANCO_RUN=vuoti: mattina presto e pomeriggio lento; stesso report di C8c, il "prima" e' il giro di C8c (poi C8b).
const VUOTI = process.env.BANCO_RUN === 'vuoti';
// C8e — BANCO_RUN=tetto: il tetto conta solo le visite; stesso report, il "prima" e' il giro di C8d (o C8c).
const TETTO = process.env.BANCO_RUN === 'tetto';
// TESTI — BANCO_RUN=testi: i testi a schermo (italiano, concordati, mai ripetuti); 6 casi, c7 e c8 a 0.
const TESTI = process.env.BANCO_RUN === 'testi';
const argReport = process.argv.indexOf('--report');
let jsonPath, nome;
if (argReport > -1) {
    jsonPath = path.resolve(process.argv[argReport + 1]);
    nome = path.basename(jsonPath, '.json');
} else {
    // MIG-PLACES — BANCO_PLACES=new: stessi casi con la ricerca nuova (solo l'account di prova), file `-new`.
    const suffisso = TESTI ? '-testi' : TETTO ? '-tetto' : VUOTI ? '-vuoti' : PASTI ? '-pasti' : MINIMI ? '-minimi' : SERA ? '-sera' : SERA_PRIMA ? '-sera-prima' : COMPOSIZIONE ? '-composizione' : CONTINUITA ? '-continuita' : FESTIVI ? '-festivi' : C6A ? '-c6a' : ORARI ? '-orari' : (NUOVA ? '-new' : '');
    nome = `${oggi}-banco-esteso${suffisso}`;
    for (let i = 2; existsSync(path.join(root, 'docs/prove/dati', `${nome}.json`)); i++) nome = `${oggi}-banco-esteso${suffisso}-${i}`;
    jsonPath = path.join(root, 'docs/prove/dati', `${nome}.json`);
    const r = spawnSync('npx', ['vitest', 'run', '-c', 'scripts/banco/vitest.esteso.config.js'], {
        cwd: root, stdio: 'inherit', env: { ...process.env, BANCO_OUT: jsonPath },
    });
    if (!existsSync(jsonPath)) { console.error('[banco-esteso] nessun risultato scritto: niente report.'); process.exit(r.status || 1); }
    // Classe 9 — ONB-1 (login → logout → login su browser vuoto → modifica interessi). Costo 0. Non si rifa' nel giro `new`.
    if (!NUOVA) {
    const onbOut = path.join(os.tmpdir(), `onb1-${Date.now()}.json`);
    spawnSync('npx', ['vitest', 'run', '-c', 'scripts/prova-reale/vitest.prova.config.js', 'scripts/prova-reale/onb1.live.js'], {
        cwd: root, stdio: 'inherit', env: { ...process.env, PROVA_OUT: onbOut },
    });
    const raw0 = JSON.parse(readFileSync(jsonPath, 'utf8'));
    raw0.onb1 = existsSync(onbOut) ? JSON.parse(readFileSync(onbOut, 'utf8')) : null;
    writeFileSync(jsonPath, JSON.stringify(raw0, null, 1));
    }
}

if (argReport > -1 && /-testi/.test(process.argv[argReport + 1])) {
    // TESTI — il report unisce i giri dello stesso task (il tetto e' del task: si somma a mano)
    const files = process.argv[argReport + 1].split(',').map(f => path.resolve(f.trim()));
    const raws = files.map(f => ({ ...JSON.parse(readFileSync(f, 'utf8')), _nome: path.basename(f) }));
    const nomeDoc = `${oggi}-testi`;
    const nPath = path.join(root, 'docs/prove/dati', `${nomeDoc}-note.md`);
    const { markdown: md, sintesi } = reportTesti(unisciPasti(raws), config, { commit, files: files.map(f => path.basename(f)) });
    writeFileSync(path.join(root, 'docs/prove', `${nomeDoc}.md`), md + (existsSync(nPath) ? '\n' + readFileSync(nPath, 'utf8') : '') + '\n');
    console.log(`[banco-esteso] report testi: docs/prove/${nomeDoc}.md | ${sintesi.misurati}/${sintesi.casi} casi | c7 ${sintesi.c7} | c8 ${sintesi.c8} | c1 ${sintesi.c1} | spesa ${sintesi.spesa}`);
    process.exit(0);
}
if (argReport > -1 && /-(pasti|vuoti|tetto)/.test(process.argv[argReport + 1])) {
    const tetto = /-tetto/.test(process.argv[argReport + 1]);
    const vuoti = /-vuoti/.test(process.argv[argReport + 1]) || tetto;
    // C8c — il report unisce piu' grezzi dello stesso task
    const files = process.argv[argReport + 1].split(',').map(f => path.resolve(f.trim()));
    const raws = files.map(f => ({ ...JSON.parse(readFileSync(f, 'utf8')), _nome: path.basename(f) }));
    const casiBase = [];
    const viste = new Set();
    const baseFile = [];
    for (const f of ((tetto ? config.esteso.baselineTetto : vuoti ? config.esteso.baselineVuoti : config.esteso.baselinePasti) || []).map(f => path.join(root, f)).filter(f => existsSync(f))) {
        for (const c of JSON.parse(readFileSync(f, 'utf8')).casi || []) if (!viste.has(c.id)) { viste.add(c.id); casiBase.push({ ...c, _file: path.basename(f) }); if (!baseFile.includes(path.basename(f))) baseFile.push(path.basename(f)); }
    }
    const nomeDoc = tetto ? `${oggi}-c8e-tetto` : vuoti ? `${oggi}-c8d-vuoti` : `${oggi}-c8c-pasti`;
    const nPath = path.join(root, 'docs/prove/dati', `${nomeDoc}-note.md`);
    const dPath = path.join(root, 'docs/prove/dati', `${nomeDoc}-diagnosi.md`);
    const { markdown: md, sintesi } = reportPasti(casiBase, unisciPasti(raws), config, { commit, baseFile, tetto: vuoti ? config.esteso.tettoVuotiUsd : config.esteso.tettoPastiUsd, fermo: (vuoti ? config.esteso.tettoVuotiUsd : config.esteso.tettoPastiUsd) * 0.9, vuoti, titolo: tetto ? 'C8e — il tetto conta le visite, la tappa leggera segue il tipo principale' : null,
        diagnosi: existsSync(dPath) ? readFileSync(dPath, 'utf8') : null });
    writeFileSync(path.join(root, 'docs/prove', `${nomeDoc}.md`), md + (existsSync(nPath) ? '\n' + readFileSync(nPath, 'utf8') : '') + '\n');
    const cl = (k) => `${sintesi.classi[k].dopo} (prima ${sintesi.classi[k].prima})`;
    console.log(`[banco-esteso] report pasti: docs/prove/${nomeDoc}.md | ${sintesi.misurati}/${sintesi.casi} casi | c1 ${cl('c1')} | c2 ${cl('c2')} | c3 ${cl('c3')} | c4 ${cl('c4')} | c5 ${cl('c5')} | c10 ${cl('c10')} | c11 ${cl('c11')} | c12 ${cl('c12')} | c13 ${cl('c13')} | spesa task ${sintesi.spesa}`);
    process.exit(0);
}
if (argReport > -1 && /-minimi/.test(process.argv[argReport + 1])) {
    // C8b — il report unisce piu' grezzi dello stesso task
    const files = process.argv[argReport + 1].split(',').map(f => path.resolve(f.trim()));
    const raws = files.map(f => ({ ...JSON.parse(readFileSync(f, 'utf8')), _nome: path.basename(f) }));
    const casiBase = [];
    const viste = new Set();
    for (const f of (config.esteso.baselineMinimi || []).map(f => path.join(root, f)).filter(f => existsSync(f))) {
        for (const c of JSON.parse(readFileSync(f, 'utf8')).casi || []) if (!viste.has(c.id)) { viste.add(c.id); casiBase.push({ ...c, _file: path.basename(f) }); }
    }
    const nomeDoc = `${oggi}-c8b-minimi`;
    const nPath = path.join(root, 'docs/prove/dati', `${nomeDoc}-note.md`);
    const dPath = path.join(root, 'docs/prove/dati', `${nomeDoc}-diagnosi.md`);
    const { markdown: md, sintesi } = reportMinimi(casiBase, unisciGrezzi(raws), config, { commit, diagnosi: existsSync(dPath) ? readFileSync(dPath, 'utf8') : null });
    writeFileSync(path.join(root, 'docs/prove', `${nomeDoc}.md`), md + (existsSync(nPath) ? '\n' + readFileSync(nPath, 'utf8') : '') + '\n');
    const cl = (k) => `${sintesi.classi[k].dopo} (prima ${sintesi.classi[k].prima})`;
    console.log(`[banco-esteso] report minimi: docs/prove/${nomeDoc}.md | ${sintesi.misurati}/${sintesi.casi} casi | c1 ${cl('c1')} | c2 ${cl('c2')} | c3 ${cl('c3')} | c4 ${cl('c4')} | c5 ${cl('c5')} | c11 ${cl('c11')} | c12 ${cl('c12')} | c13 ${cl('c13')} | peggioramenti ${sintesi.peggioramenti.length} | spesa task ${sintesi.spesa}`);
    process.exit(0);
}
const raw = JSON.parse(readFileSync(jsonPath, 'utf8'));
if (raw.motore === 'new' && /-(pasti|vuoti|tetto|testi)/.test(nome)) {
    // C8c — un giro singolo di prova (il report vero unisce tutti i giri con --report a,b)
    console.log(`[banco-esteso] grezzo del giro: ${path.relative(root, jsonPath)} | spesa ${raw.costo?.totale?.toFixed?.(3) ?? '?'} (il report: BANCO_RUN=pasti npm run banco:esteso -- --report a.json,b.json)`);
    process.exit(0);
}
if (raw.motore === 'new' && /-minimi/.test(nome)) {
    // C8b — un giro singolo di prova (il report vero unisce tutti i giri con --report a,b,c)
    console.log(`[banco-esteso] grezzo del giro: ${path.relative(root, jsonPath)} | spesa ${raw.costo?.totale?.toFixed?.(3) ?? '?'} (il report: npm run banco -- --report a.json,b.json con BANCO_RUN=minimi)`);
    process.exit(0);
}
if (raw.motore === 'new' && /-sera-prima/.test(nome)) {
    // C8a — il grezzo del codice di prima: nessun report, serve da "prima" del giro sera.
    console.log(`[banco-esteso] grezzo del codice di prima: ${path.relative(root, jsonPath)} | spesa ${raw.costo?.totale?.toFixed?.(3) ?? '?'}`);
    process.exit(0);
}
if (raw.motore === 'new' && /-sera/.test(nome)) {
    // C8a — il giro della sera, contro i giri di prima degli stessi casi (il piu' recente che contiene il caso).
    const fonti = (config.esteso.baselineSera || []).map(f => path.join(root, f)).filter(f => existsSync(f));
    const viste = new Set();
    const casiBase = [];
    for (const f of fonti) for (const c of JSON.parse(readFileSync(f, 'utf8')).casi || []) if (!viste.has(c.id)) { viste.add(c.id); casiBase.push(c); }
    const base = { casi: casiBase };
    const nomeDoc = `${nome.slice(0, 10)}-c8a-sera`;
    const nPath = path.join(root, 'docs/prove/dati', `${nomeDoc}-note.md`);
    const dPath = path.join(root, 'docs/prove/dati', `${nomeDoc}-diagnosi.md`);
    const { markdown: md, sintesi } = reportSera(base, raw, config, { baseNome: fonti.map(f => path.basename(f)).join(', '), nuovoNome: path.basename(jsonPath), commit,
        diagnosi: existsSync(dPath) ? readFileSync(dPath, 'utf8') : null });
    writeFileSync(path.join(root, 'docs/prove', `${nomeDoc}.md`), md + (existsSync(nPath) ? '\n' + readFileSync(nPath, 'utf8') : '') + '\n');
    const cl = (k) => `${sintesi.classi[k].dopo} (prima ${sintesi.classi[k].prima})`;
    console.log(`[banco-esteso] report sera: docs/prove/${nomeDoc}.md | grezzo: ${path.relative(root, jsonPath)} | c1 ${cl('c1')} | c4 ${cl('c4')} | c5 ${cl('c5')} | c11 ${cl('c11')} | c13 ${cl('c13')} | spesa ${sintesi.spesa}`);
    process.exit(0);
}
if (raw.motore === 'new' && /-composizione/.test(nome)) {
    // C7 — il giro con la composizione della giornata, contro il giro CONTINUITA' degli stessi casi.
    const basePath = path.join(root, config.esteso.baselineContinuita);
    const base = JSON.parse(readFileSync(basePath, 'utf8'));
    const nomeDoc = `${nome.slice(0, 10)}-c7-composizione`;
    const nPath = path.join(root, 'docs/prove/dati', `${nomeDoc}-note.md`);
    const { markdown: md, sintesi } = reportComposizione(base, raw, config, { baseNome: path.basename(basePath), nuovoNome: path.basename(jsonPath), commit });
    writeFileSync(path.join(root, 'docs/prove', `${nomeDoc}.md`), md + (existsSync(nPath) ? '\n' + readFileSync(nPath, 'utf8') : '') + '\n');
    const cl = (k) => `${sintesi.classi[k].dopo} (prima ${sintesi.classi[k].prima}${sintesi.classi[k].nuoviCasi ? `, casi nuovi ${sintesi.classi[k].nuoviCasi}` : ''})`;
    console.log(`[banco-esteso] report c7: docs/prove/${nomeDoc}.md | grezzo: ${path.relative(root, jsonPath)} | c1 ${cl('c1')} | c2 ${cl('c2')} | c3 ${cl('c3')} | c12 ${cl('c12')} | c5 ${cl('c5')} | c11 ${cl('c11')} | spesa ${sintesi.spesa}`);
    process.exit(0);
}
if (raw.motore === 'new' && /-continuita/.test(nome)) {
    // CONTINUITA' — il giro con i buchi riempiti o dichiarati, contro il giro C6a degli stessi casi.
    const basePath = path.join(root, config.esteso.baselineC6a);
    const base = JSON.parse(readFileSync(basePath, 'utf8'));
    const primaPath = path.join(root, 'docs/prove/dati/2026-10-13-banco-esteso-continuita-prima.json');
    const prima = existsSync(primaPath) ? JSON.parse(readFileSync(primaPath, 'utf8')) : null;
    const nomeDoc = `${nome.slice(0, 10)}-continuita`;
    const nPath = path.join(root, 'docs/prove/dati', `${nomeDoc}-note.md`);
    const { markdown: md, sintesi } = reportContinuita(base, raw, config, { baseNome: path.basename(basePath), nuovoNome: path.basename(jsonPath), commit, prima, primaNome: path.basename(primaPath) });
    writeFileSync(path.join(root, 'docs/prove', `${nomeDoc}.md`), md + (existsSync(nPath) ? '\n' + readFileSync(nPath, 'utf8') : '') + '\n');
    console.log(`[banco-esteso] report continuita: docs/prove/${nomeDoc}.md | grezzo: ${path.relative(root, jsonPath)} | c11: ${sintesi.c11.dopo} (prima ${sintesi.c11.prima}) | Catania: ${sintesi.c11.extraDopo} | c5: ${sintesi.c5.dopo} | spesa ${sintesi.spesa}`);
    process.exit(0);
}
if (raw.motore === 'new' && /-festivi/.test(nome)) {
    // ORARI-FESTIVI — il giro con gli orari del giorno, contro il giro C6a degli stessi casi.
    const basePath = path.join(root, config.esteso.baselineC6a);
    const base = JSON.parse(readFileSync(basePath, 'utf8'));
    const nomeDoc = `${nome.slice(0, 10)}-orari-festivi`;
    const nPath = path.join(root, 'docs/prove/dati', `${nomeDoc}-note.md`);
    const { markdown: md, sintesi } = reportFestivi(base, raw, config, { baseNome: path.basename(basePath), nuovoNome: path.basename(jsonPath), commit });
    writeFileSync(path.join(root, 'docs/prove', `${nomeDoc}.md`), md + (existsSync(nPath) ? '\n' + readFileSync(nPath, 'utf8') : '') + '\n');
    console.log(`[banco-esteso] report orari-festivi: docs/prove/${nomeDoc}.md | grezzo: ${path.relative(root, jsonPath)} | c5: ${sintesi.c5.dopo} (solo settimana ${sintesi.c5SoloSettimana}) | tappe dal giorno ${sintesi.tappeDaGiorno} | posti con orari diversi ${sintesi.postiDiversi} | spesa ${sintesi.spesa}`);
    process.exit(0);
}
if (raw.motore === 'new' && /-c6a/.test(nome)) {
    // C6a — il giro con il tipo principale, contro il giro ORARI.
    const basePath = path.join(root, config.esteso.baselineOrari);
    const base = JSON.parse(readFileSync(basePath, 'utf8'));
    const nomeDoc = `${nome.slice(0, 10)}-c6a`;
    const nPath = path.join(root, 'docs/prove/dati', `${nomeDoc}-note.md`);
    const { markdown: md, sintesi } = reportC6a(base, raw, config, { baseNome: path.basename(basePath), nuovoNome: path.basename(jsonPath), commit });
    writeFileSync(path.join(root, 'docs/prove', `${nomeDoc}.md`), md + (existsSync(nPath) ? '\n' + readFileSync(nPath, 'utf8') : '') + '\n');
    console.log(`[banco-esteso] report c6a: docs/prove/${nomeDoc}.md | grezzo: ${path.relative(root, jsonPath)} | c6: ${sintesi.c6.dopo} (prima ${sintesi.c6.prima}) | c5: ${sintesi.c5.dopo} (prima ${sintesi.c5.prima}) | caffe/bar esercitati: ${sintesi.caffeBarEsercitati} | spesa ${sintesi.spesa}`);
    process.exit(0);
}
if (raw.motore === 'new' && /-orari/.test(nome)) {
    // ORARI — il giro con la regola degli orari, contro il giro `new` di prima della regola.
    const basePath = path.join(root, config.esteso.baselineNew);
    const base = JSON.parse(readFileSync(basePath, 'utf8'));
    const nomeDoc = `${nome.slice(0, 10)}-orari`;
    const nPath = path.join(root, 'docs/prove/dati', `${nomeDoc}-note.md`);
    const { markdown: md, sintesi } = reportOrari(base, raw, config, { baseNome: path.basename(basePath), nuovoNome: path.basename(jsonPath), commit });
    writeFileSync(path.join(root, 'docs/prove', `${nomeDoc}.md`), md + (existsSync(nPath) ? '\n' + readFileSync(nPath, 'utf8') : '') + '\n');
    console.log(`[banco-esteso] report orari: docs/prove/${nomeDoc}.md | grezzo: ${path.relative(root, jsonPath)} | c5: ${sintesi.c5.dopo} violazioni (prima ${sintesi.c5.prima}) in ${sintesi.c5.casiDopo} casi | spesa ${sintesi.spesa}`);
    process.exit(0);
}
if (raw.motore === 'new') {
    // MIG-PLACES — niente report del banco: il confronto con il giro legacy.
    const legacyPath = path.join(root, config.esteso.baselineLegacy);
    const legacy = JSON.parse(readFileSync(legacyPath, 'utf8'));
    const nomeDoc = `${nome.slice(0, 10)}-mig-places`;
    const nPath = path.join(root, 'docs/prove/dati', `${nomeDoc}-note.md`);
    const { markdown: md, peggiorate } = confrontoPlaces(legacy, raw, config, { legacyNome: path.basename(legacyPath), nuovoNome: path.basename(jsonPath), commit });
    const out = md + (existsSync(nPath) ? '\n' + readFileSync(nPath, 'utf8') : '');
    writeFileSync(path.join(root, 'docs/prove', `${nomeDoc}.md`), out + '\n');
    console.log(`[banco-esteso] confronto: docs/prove/${nomeDoc}.md | grezzo: ${path.relative(root, jsonPath)} | voci peggiorate oltre la varianza: ${peggiorate}`);
    process.exit(0);
}
const notePath = path.join(root, 'docs/prove/dati', `${nome}-note.md`);
const { markdown, analisi } = buildReportEsteso(raw, config, { data: nome.slice(0, 10), commit, note: existsSync(notePath) ? readFileSync(notePath, 'utf8') : null });
const mdPath = path.join(root, 'docs/prove', `${nome}.md`);
mkdirSync(path.dirname(mdPath), { recursive: true });
writeFileSync(mdPath, markdown + '\n');
const tot = analisi.perClasse.reduce((a, c) => a + c.violazioni, 0);
console.log(`[banco-esteso] report: ${path.relative(root, mdPath)} | grezzo: ${path.relative(root, jsonPath)} | violazioni: ${tot}`);
