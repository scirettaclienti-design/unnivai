// BANCO-40 — dal grezzo di un giro (vero o replay) agli esiti compatti che si salvano nel repo, e la tabella del report.
// Funzioni pure. Gli esiti portano solo quello che serve a rifare i controlli e a confrontare un replay: la firma delle tappe
// (place_id e ora di arrivo), gli orari di Google delle tappe, l'esito di ogni controllo. Niente testi dei racconti, niente chiavi.
import { controllaCaso, CONTROLLI40 } from './controlli40.js';

const vere = (c) => (c.tours || []).map(t => (t.stops || []).filter(s => s && !s.tempoLibero && s.place_id));

/** La firma di un giro: per ogni tour, le tappe vere come `place_id@ora`. Due giri con la stessa firma hanno le stesse tappe agli stessi orari. */
export const firmaDi = (caso) => vere(caso).map(stops => stops.map(s => `${s.place_id}@${s.at ?? ''}`));

/** Il caso del grezzo → l'esito compatto, con i controlli rifatti. `orari` = gli orari di Google per place_id (dal giro vero). */
export function esitoDi(caso, meta, cfg, orari = null) {
    const conOrari = orari ? { ...caso, orari: { ...(caso.orari || {}), ...Object.fromEntries(Object.entries(orari).filter(([id]) => !(caso.orari || {})[id])) } } : caso;
    const r = controllaCaso(conOrari, meta, cfg);
    const mie = Object.fromEntries(vere(caso).flat().filter(s => conOrari.orari?.[s.place_id]).map(s => [s.place_id, conOrari.orari[s.place_id]]));
    return {
        id: caso.id, modo: caso.modo, luogo: caso.luogo, posizione: meta?.posizione ?? null, ora: caso.ora, griglia: meta?.griglia ?? null,
        stato: r.stato, motivo: r.motivo ?? null, nota: r.nota ?? null, tappe: r.tappe, controlli: r.controlli ?? null,
        firma: firmaDi(caso), titoli: (caso.tours || []).map(t => t.titolo || t.tema || null),
        orari: mie,
        costo: { spesaUsd: caso.spesaUsd ?? null, secs: caso.secs ?? null, ai: caso.ai?.chiamate ?? null, google: caso.google ?? null, googleHit: caso.googleHit ?? null },
        source: caso.source ?? null,
    };
}

/** Un replay è uguale al giro vero se ogni caso ha la stessa firma, lo stesso stato e le stesse violazioni in ogni controllo. */
export function confrontaEsiti(veri, replay) {
    const perId = new Map(replay.map(e => [e.id, e]));
    return veri.map((v) => {
        const r = perId.get(v.id);
        if (!r) return { id: v.id, uguale: false, perche: 'caso assente nel replay' };
        const diff = [];
        if (v.stato !== r.stato) diff.push(`stato ${v.stato} → ${r.stato}`);
        if (JSON.stringify(v.firma) !== JSON.stringify(r.firma)) diff.push('tappe o orari diversi');
        for (const [k] of CONTROLLI40) {
            const a = v.controlli?.[k], b = r.controlli?.[k];
            if (JSON.stringify(a?.violazioni ?? null) !== JSON.stringify(b?.violazioni ?? null)) diff.push(`controllo ${k} diverso`);
        }
        return { id: v.id, uguale: diff.length === 0, perche: diff.join('; ') || null };
    });
}

const MARCA = { ok: '✅', ko: '❌', errore: '⛔', saltato: '⏭' };
const casella = (e, k) => (!e.controlli ? '—' : e.controlli[k] ? (e.controlli[k].ok ? '✅' : '❌') : '—');
const griglia = (g) => (g ? [g.scala, g.ora, g.richiesta, g.dna && `DNA ${g.dna}`, g.ospite && 'ospite', g.lontano && 'lontano', g.mezzo].filter(Boolean).join(', ') : '');

/** La tabella dei casi in markdown. */
export function tabellaMd(esiti) {
    const righe = esiti.map((e, i) => `| ${i + 1} | \`${e.id}\` | ${e.modo}${e.posizione ? ` (da ${e.posizione})` : ''} | ${e.luogo} | ${e.ora} | ${griglia(e.griglia)} | ${e.tappe} | `
        + `${CONTROLLI40.map(([k]) => casella(e, k)).join(' | ')} | ${MARCA[e.stato] ?? e.stato} ${e.stato}${e.motivo ? ` — ${e.motivo}` : ''}${e.nota ? ` — ${e.nota}` : ''} |`);
    return ['| # | Caso | Modo | Luogo | Ora | Griglia | Tappe | Aperte | Distanze | Città | Titolo | Frasi | Esito |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|', ...righe].join('\n');
}

/** Il riepilogo: quanti passano e i controlli che falliscono. */
export function riepilogo(esiti) {
    const per = (s) => esiti.filter(e => e.stato === s).length;
    const falliti = Object.fromEntries(CONTROLLI40.map(([k, nome]) => [k, { nome, casi: esiti.filter(e => e.controlli && e.controlli[k] && !e.controlli[k].ok).map(e => e.id) }]));
    return { totale: esiti.length, ok: per('ok'), ko: per('ko'), errore: per('errore'), saltato: per('saltato'), falliti };
}

/** L'elenco dei difetti per Ivano: per ogni controllo fallito, le violazioni caso per caso. */
export function difettiMd(esiti) {
    const out = [];
    for (const e of esiti) {
        if (e.stato === 'errore' || e.stato === 'saltato') { out.push(`- \`${e.id}\` — ${e.stato}: ${e.motivo}`); continue; }
        for (const [k, nome] of CONTROLLI40) {
            const c = e.controlli?.[k];
            if (c && !c.ok) out.push(`- \`${e.id}\` — ${nome}: ${c.violazioni.slice(0, 3).join(' · ')}${c.violazioni.length > 3 ? ` (+${c.violazioni.length - 3})` : ''}`);
        }
    }
    return out.join('\n');
}
