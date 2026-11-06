#!/usr/bin/env node
// T29 — il grafico dell'audit del DNA, dal json di dna-audit.giro.js: un pannello per categoria (linee che si toccano al 100% non si leggono
// sovrapposte), un pannello per la fiducia, stesso asse degli eventi. SVG statico accanto al report.
// node scripts/impostazioni/grafico-dna.mjs <dna.json> <uscita.svg>
import { readFileSync, writeFileSync } from 'node:fs';

const [, , IN, OUT] = process.argv;
const j = JSON.parse(readFileSync(IN, 'utf8'));
const E = j.eventi;
const SERIE = [['cultura', 'Cultura', '#2a78d6'], ['food', 'Cibo', '#eb6834'], ['natura', 'Natura', '#1baf7a'], ['arte', 'Arte', '#eda100'], ['relax', 'Relax', '#e87ba4']];
const FID = '#6250d6';
const W = 860, L = 96, R = 56, T = 56, PH = 74, GAP = 18;
const pannelli = [...SERIE.map(([k, n, c]) => ({ n, c, v: (e) => e.pesi[k], max: 1 })), { n: 'Fiducia', c: FID, v: (e) => e.fiducia, max: 0.45 }];
const H = T + pannelli.length * (PH + GAP) + 150;
const x = (i) => L + (i / (E.length - 1)) * (W - L - R);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const pct = (v) => `${Math.round(v * 100)}%`;
const INK = '#0b0b0b', SEC = '#52514e', GRID = '#e4e3df', SURF = '#fcfcfb';

let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="-apple-system, 'Helvetica Neue', Arial, sans-serif" role="img" aria-label="Pesi del DNA a ogni evento di un utente finto">
<rect width="${W}" height="${H}" fill="${SURF}"/>
<text x="${L}" y="24" font-size="16" font-weight="600" fill="${INK}">Il DNA di un utente finto, evento per evento</text>
<text x="${L}" y="42" font-size="12" fill="${SEC}">Percentuale di ogni gusto dopo ogni gesto. I triangoli segnano il giro rigiocato col DNA di quel momento.</text>
`;
const correzioni = E.filter(e => /Profilo/.test(e.etichetta)).map(e => e.i);
pannelli.forEach((p, n) => {
    const y0 = T + n * (PH + GAP);
    const y = (v) => y0 + PH - (v / p.max) * PH;
    s += `<text x="${L - 12}" y="${y0 + PH / 2 + 4}" font-size="13" font-weight="600" fill="${INK}" text-anchor="end">${p.n}</text>`;
    for (const t of [0, p.max]) {
        s += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="${GRID}" stroke-width="1"/>`;
        s += `<text x="${W - R + 8}" y="${y(t) + 4}" font-size="10" fill="${SEC}">${pct(t)}</text>`;
    }
    for (const i of correzioni) s += `<line x1="${x(i)}" x2="${x(i)}" y1="${y0}" y2="${y0 + PH}" stroke="${GRID}" stroke-width="1" stroke-dasharray="2 3"/>`;
    let d = '';
    E.forEach((e, i) => { const px = x(i), py = y(p.v(e)); d += i === 0 ? `M${px} ${py}` : `H${px}V${py}`; });
    s += `<path d="${d}" fill="none" stroke="${p.c}" stroke-width="2" stroke-linejoin="round"/>`;
    E.forEach((e, i) => {
        const prima = i ? p.v(E[i - 1]) : null;
        if (i === 0 || p.v(e) !== prima) s += `<circle cx="${x(i)}" cy="${y(p.v(e))}" r="3" fill="${p.c}" stroke="${SURF}" stroke-width="1.5"/>`;
    });
    const ultimo = E.at(-1);
    const fine = y(p.v(ultimo));
    s += `<text x="${W - R - 4}" y="${fine < y0 + 14 ? fine + 14 : fine - 6}" font-size="11" fill="${INK}" text-anchor="end">${pct(p.v(ultimo))}</text>\n`;
});
// gli eventi: numero sull'asse, elenco sotto
const yb = T + pannelli.length * (PH + GAP) - 4;
E.forEach((e, i) => {
    s += `<text x="${x(i)}" y="${yb + 8}" font-size="10" fill="${SEC}" text-anchor="middle">${i + 1}</text>`;
    if ((j.giri || []).some(g => g.i === i)) s += `<path d="M${x(i) - 4} ${yb + 20}h8l-4 -6z" fill="${INK}"/>`;
});
const colonne = 2, perColonna = Math.ceil(E.length / colonne);
E.forEach((e, i) => {
    const c = Math.floor(i / perColonna), r = i % perColonna;
    s += `<text x="${L + c * 370}" y="${yb + 40 + r * 13}" font-size="10.5" fill="${SEC}">${i + 1}. ${esc(e.etichetta)}${e.giorno ? ` (giorno ${e.giorno})` : ''}</text>`;
});
s += '\n</svg>\n';
writeFileSync(OUT, s);
console.log(`scritto ${OUT}`);
