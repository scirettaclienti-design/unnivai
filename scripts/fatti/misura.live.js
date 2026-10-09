// P3d-h — misura della copertura dei fatti sulle 18 tappe-luogo delle prove
// P3d-e (tappe-p3de.json: nome, coordinate e types presi una volta dal proxy
// Places). Nessuna chiamata AI, nessuna cache: rete vera, tetto reale di 4 s.
//
//   LIVE_SUPABASE_URL=… LIVE_ANON_KEY=… [GIRI=3] [CACHE=1] [OUT=file.json] \
//     npx vitest run -c scripts/fatti/vitest.fatti.config.js
//
// Senza CACHE: ogni giro e' una prima visita (nessuna cache letta o scritta).
// Con CACHE=1: la cache place_facts VERA si legge e si scrive (anche i fatti
// OSM arrivati dopo il tetto, in sottofondo); fra un giro e l'altro si aspetta
// che Overpass in sottofondo finisca: il secondo giro e' la "visita successiva".
//
// Stampa, per ogni tappa: metodo di aggancio → fonte → primo fatto.
import { it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchFactsForStops, OSM_BACKGROUND_MS } from '@/services/factsService';

const TAPPE = JSON.parse(readFileSync('scripts/fatti/tappe-p3de.json', 'utf8'));
const GIRI = Number(process.env.GIRI || 1);
const CACHE = process.env.CACHE === '1';
// Solo diagnosi: BUDGET=30000 allarga il tetto per vedere gli agganci OSM quando
// Overpass e' lento. La copertura ufficiale si misura col tetto vero (4 s).
const BUDGET = Number(process.env.BUDGET || 0) || undefined;

it('copertura fatti sulle 18 tappe-luogo P3d-e', async () => {
    const giri = [];
    for (let g = 0; g < GIRI; g += 1) {
        const righe = [];
        const tempi = [];
        for (const prova of (process.env.PROVE || 'roma,catania,perte').split(',')) {
            const stops = TAPPE.filter(t => t.prova === prova).map(t => ({ place_id: t.place_id, name: t.name, lat: t.lat, lng: t.lng, types: t.types }));
            const r = await fetchFactsForStops(stops, { city: stops.length ? TAPPE.find(t => t.prova === prova).city : '', useCache: CACHE, ...(BUDGET ? { budgetMs: BUDGET } : {}) });
            tempi.push({ prova, ms: r.report.ms, timeout: r.report.timeout, daCache: r.report.daCache, errori: r.report.errori });
            // Con la cache: si lascia finire Overpass in sottofondo prima della
            // prova dopo (2 slot per IP: tre richieste di fila danno 429).
            if (CACHE && r.report.osmInSottofondo) await new Promise(res => { setTimeout(res, OSM_BACKGROUND_MS + 2000); });
            for (const s of stops) {
                const e = r.byId.get(s.place_id) || { fatti: [] };
                righe.push({ prova, tappa: s.name, aggancio: e.aggancio || null, fonti: (e.fonti || []).map(f => f.fonte), fatti: e.fatti.map(f => `[${f.fonte}] ${f.testo}`) });
            }
            for (const x of r.report.scartati) righe.push({ prova, scartato: x });
        }
        const tappe = righe.filter(x => x.tappa);
        giri.push({ coperte: tappe.filter(x => x.fatti.length > 0).length, totale: tappe.length, tempi, righe });
    }
    for (const [i, g] of giri.entries()) {
        console.log(`\n=== giro ${i + 1}: ${g.coperte}/${g.totale} tappe con fatti — tempi ${g.tempi.map(t => `${t.prova} ${t.ms} ms${t.timeout ? ' (tetto)' : ''}`).join(', ')}`);
        for (const x of g.righe) {
            if (x.scartato) { console.log(`   ✗ scartato (${x.scartato.metodo}) ${x.scartato.tappa} → ${x.scartato.titolo}: ${x.scartato.motivo}`); continue; }
            const a = x.aggancio
                ? `${x.aggancio.metodo}${x.aggancio.titolo ? `: ${x.aggancio.titolo}` : ''}${Number.isFinite(x.aggancio.distanza) ? ` (${x.aggancio.distanza} m)` : ''}`
                : '—';
            console.log(`${x.fatti.length ? '✓' : '·'} ${x.tappa} → ${a} → ${x.fatti[0] || 'nessun fatto'}`);
        }
    }
    const ms = giri.flatMap(g => g.tempi.map(t => t.ms));
    console.log(`\ntempo medio della ricerca: ${Math.round(ms.reduce((a, b) => a + b, 0) / ms.length)} ms su ${ms.length} ricerche (${giri.length} giri × 3 prove)`);
    if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(giri, null, 1));
});
