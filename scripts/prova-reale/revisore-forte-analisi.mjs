// REVISORE-FORTE — dai verdetti grezzi (…-revisore-forte-misura.json) e dalle etichette lette a mano (…-revisore-forte-etichette.json)
// ai numeri del report. Uso: node scripts/prova-reale/revisore-forte-analisi.mjs [elenco]
import fs from 'node:fs';
const m = JSON.parse(fs.readFileSync('docs/prove/dati/2026-11-02-revisore-forte-misura.json', 'utf8')).righe;
const c = JSON.parse(fs.readFileSync('docs/prove/dati/2026-11-02-revisore-forte-corpus.json', 'utf8')).testi;
const et = JSON.parse(fs.readFileSync('docs/prove/dati/2026-11-02-revisore-forte-etichette.json', 'utf8')).etichette; // id → { v: 'F'|'S'|'I', nota }
const MOD = ['haiku-4.5', 'sonnet-5.5'];
const lab = (id) => et[id]?.v;
const media = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const p95 = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]; };
const insiemi = { 'misura r5 (1-99)': (t) => !t.sintetico, 'iniezioni (100+)': (t) => t.sintetico };
const out = [];
for (const [nomeIns, filtro] of Object.entries(insiemi)) {
    const ids = new Set(c.filter(filtro).map((t) => t.id));
    out.push(`\n## ${nomeIns}: ${ids.size} testi; I=${[...ids].filter((i) => lab(i) === 'I').length} F=${[...ids].filter((i) => lab(i) === 'F').length} S=${[...ids].filter((i) => lab(i) === 'S').length}`);
    out.push('| modello | lancio | n | falsi sì (I passati) | falsi no (F scartati) | sfumature S scartate | resa (passati/n) | non letti/errori | $ per racconto | s per racconto (media / p95) |');
    out.push('|---|---|---|---|---|---|---|---|---|---|');
    for (const mod of MOD) for (const l of [1, 2, 3, 'tutti']) {
        const r = m.filter((x) => x.modello === mod && ids.has(x.id) && (l === 'tutti' || x.lancio === l));
        if (!r.length) continue;
        const I = r.filter((x) => lab(x.id) === 'I'), F = r.filter((x) => lab(x.id) === 'F'), S = r.filter((x) => lab(x.id) === 'S');
        out.push(`| ${mod} | ${l} | ${r.length} | ${I.filter((x) => x.ok).length}/${I.length} | ${F.filter((x) => !x.ok).length}/${F.length} | ${S.filter((x) => !x.ok).length}/${S.length} | ${r.filter((x) => x.ok).length}/${r.length} (${(100 * r.filter((x) => x.ok).length / r.length).toFixed(0)}%) | ${r.filter((x) => x.errore || !x.leggibile).length} | ${media(r.map((x) => x.costoUsd || 0)).toFixed(5)} | ${(media(r.map((x) => x.ms || 0)) / 1000).toFixed(2)} / ${(p95(r.map((x) => x.ms || 0)) / 1000).toFixed(2)} |`);
    }
}
// token medi
for (const mod of MOD) { const r = m.filter((x) => x.modello === mod && !x.errore); out.push(`\n${mod}: token prompt medi ${media(r.map((x) => x.promptTok)).toFixed(0)}, token risposta medi ${media(r.map((x) => x.outTok)).toFixed(0)}, modelli usati ${[...new Set(r.map((x) => x.usato))].join(',')}, ripiego ${r.filter((x) => x.ripiego).length}, tentativi>1 ${r.filter((x) => x.tentativi > 1).length}`); }
// giudizi per testo
out.push('\n## Per testo (passati su 3 lanci: H=Haiku 4.5, S=Sonnet 5.5) — solo dove differiscono o dove c\'è un\'invenzione');
const det = [];
for (const t of c) {
    const g = (mod) => m.filter((x) => x.modello === mod && x.id === t.id);
    const h = g('haiku-4.5'), s = g('sonnet-5.5');
    if (!h.length || !s.length) continue;
    const ph = h.filter((x) => x.ok).length, ps = s.filter((x) => x.ok).length;
    if (ph !== ps || lab(t.id) === 'I' || (ph !== 0 && ph !== 3) || (ps !== 0 && ps !== 3)) {
        const motivi = (arr) => [...new Set(arr.flatMap((x) => (x.frasi || []).filter((f) => !f.nelleFonti).map((f) => `f${f.n}: ${f.motivo}`)))].join(' | ');
        det.push(`[${t.id}] ${t.nome} · vero=${lab(t.id)}${et[t.id]?.nota ? ` (${et[t.id].nota})` : ''} · H ${ph}/3 · S ${ps}/3\n   testo: ${t.testo}\n   H no: ${motivi(h) || '-'}\n   S no: ${motivi(s) || '-'}`);
    }
}
out.push(det.join('\n'));
fs.writeFileSync(process.argv[2] || '/dev/stdout', out.join('\n') + '\n');
