/** NAV-AUDIT — dai JSON delle due prove (10:00 e 21:30) le tabelle in markdown: per stato, latenze, voce. node scripts/prova-nav/nav-audit-tabella.mjs */
import fs from 'node:fs';
const carica = (t) => JSON.parse(fs.readFileSync(`docs/prove/dati/2026-10-28-nav-audit-${t}.json`, 'utf8'));
const J = { '10:00': carica('1000'), '21:30': carica('2130') };
const nomi = [...new Set(Object.values(J).flatMap(j => Object.keys(j.stati)))].sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b));
const uniq = (a) => [...new Set(a)];
const corto = (s) => s.replace(/«|»/g, '').replace(/^div|^button|^span|^p/, '').slice(0, 44);
console.log('## Per stato (peggiore dei casi misurati)\n');
console.log('| Stato | Ora | n | Mappa coperta (min–max) | Tasti < 44 px | Testi tagliati | Sovrapposizioni |');
console.log('|---|---|---|---|---|---|---|');
for (const n of nomi) for (const [ora, j] of Object.entries(J)) {
    const v = j.stati[n]; if (!v) continue;
    const cop = v.map(x => x.copertura), tp = uniq(v.flatMap(x => (x.piccoli || []).map(p => `${corto(p.nome)} ${p.w}×${p.h}`)));
    const tg = uniq(v.flatMap(x => (x.tagliati || []).map(p => `${corto(p.nome)} (${p.motivi})`))), so = uniq(v.flatMap(x => (x.sovr || []).map(p => `${corto(p.a)} ↔ ${corto(p.b)}`)));
    const el = (a) => a.length ? `${a.length}: ${a.slice(0, 2).join('; ')}${a.length > 2 ? '…' : ''}` : '0';
    console.log(`| ${n} | ${ora} | ${v.length} | ${Math.min(...cop)}–${Math.max(...cop)} % | ${el(tp)} | ${el(tg)} | ${el(so)} |`);
}
console.log('\n## Latenza fra tocco e risposta (ms, misurata nella pagina)\n');
console.log('| Tocco | Ora | Risposta nel DOM | Stato atteso visibile | Suono parte |');
console.log('|---|---|---|---|---|');
for (const [ora, j] of Object.entries(J)) for (const t of j.tocchi) console.log(`| ${t.tocco} | ${ora} | ${t.rispostaDomMs ?? '—'} | ${t.statoAttesoMs ?? '—'} | ${t.suonoMs ?? '—'} |`);
console.log('\n## La voce (10:00)\n');
console.log('| t (s sul video) | Stato | Frase | Voce | Sorgente |');
console.log('|---|---|---|---|---|');
for (const r of J['10:00'].voce) console.log(`| ${r.t} | ${r.stato} | ${r.testo} | ${r.voce} | ${r.sorgente}${r.server ? ` (server: ${r.server})` : ''} |`);
console.log('\nNote:', JSON.stringify(Object.fromEntries(Object.entries(J).map(([o, j]) => [o, j.note]))));
console.log('Errori:', JSON.stringify(Object.fromEntries(Object.entries(J).map(([o, j]) => [o, j.errori.map(e => e.slice(0, 160))]))));
