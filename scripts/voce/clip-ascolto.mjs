// VOCE-1 — genera le 6 clip della pagina di ascolto (marin e cedar) dal proxy vero e scrive public/voce-ascolto.html.
// Usa solo URL e chiave anon (pubbliche) da variabili d'ambiente; nessun segreto.
import { writeFileSync } from 'node:fs';
const URL_ = process.env.VITE_SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY;
if (!URL_ || !ANON) throw new Error('servono VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
const CLIP = [
  ['Svolta lontana', 'Fra cento metri gira a destra.'],
  ['Svolta vicina', 'Fra cinquanta metri gira a sinistra.'],
  ['Svolta adesso', 'Adesso prosegui dritto.'],
  ['Prossima tappa', 'Si va verso Piazza Duomo.'],
  ['Racconto breve', 'Le trattorie con i menù scritti a mano sono quasi sempre le migliori. Segui la calligrafia!'],
  ['Racconto lungo', 'I locali del posto sanno che il tramonto migliore non è dal punto panoramico, ma dal bar accanto.'],
];
const VOCI = ['marin', 'cedar'];
const righe = []; let nuove = 0, costo = 0;
for (const [titolo, testo] of CLIP) {
  const urls = {};
  for (const voce of VOCI) {
    let r, j;
    for (let t = 0; t < 3; t++) { // un timeout isolato di OpenAI si riprova (la cache non costa)
      r = await fetch(`${URL_}/functions/v1/openai-proxy`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON }, body: JSON.stringify({ dv: { purpose: 'voce', testo, voce } }) });
      j = await r.json();
      if (r.ok) break;
    }
    if (!r.ok) throw new Error(`${titolo}/${voce}: ${r.status} ${j.code}`);
    urls[voce] = j.url; if (j.source === 'nuova') { nuove++; costo += j.costoStimatoUsd || 0; }
    console.log(titolo, voce, j.source);
  }
  righe.push({ titolo, testo, urls });
}
const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
writeFileSync('public/voce-ascolto.html', `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Ascolto voce — Unnivai</title>
<style>:root{color-scheme:light dark;--bg:#fff;--fg:#1c1917;--mut:#6b6560;--ac:#c2410c;--bd:#e7e2dc}@media(prefers-color-scheme:dark){:root{--bg:#14110f;--fg:#f5f1ec;--mut:#a8a29e;--ac:#f97316;--bd:#2e2926}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}main{max-width:640px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:22px;margin:0 0 4px}p.s{color:var(--mut);margin:0 0 24px}.c{border:1px solid var(--bd);border-radius:18px;padding:14px 16px;margin-bottom:14px}
.t{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ac);font-weight:700}.f{margin:4px 0 10px}.v{display:flex;gap:10px;flex-wrap:wrap}
.v label{flex:1;min-width:200px;font-size:13px;color:var(--mut)}audio{width:100%;margin-top:4px}</style></head>
<body><main><h1>Ascolto voce</h1><p class="s">Le stesse 6 frasi in Marin e Cedar (gpt-4o-mini-tts). Tono: amico del posto che accompagna a piedi.</p>
${righe.map(r => `<section class="c"><div class="t">${esc(r.titolo)}</div><p class="f">${esc(r.testo)}</p><div class="v">${VOCI.map(v => `<label>${v[0].toUpperCase() + v.slice(1)}<audio controls preload="none" src="${r.urls[v]}"></audio></label>`).join('')}</div></section>`).join('\n')}
</main></body></html>
`);
console.log(JSON.stringify({ nuove, costoStimatoUsd: Math.round(costo * 1e5) / 1e5 }));
