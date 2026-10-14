// C10 — il report del giro: tour × voci dell'asticella, liste della città, costo per tour e per città-giorno, tempi,
// il giro di Ivano prima (C9, registrato) e dopo. Funzione pura: grezzi in, markdown e numeri fuori.
import { costoUsd } from './misure.js';
import { usd } from './sezioni.js';
import { eseguiControlli } from './controlli.js';
import { giornoEMinuti } from './orari.js';
import { conosceCitta, giornataPiena, suMisura, invenzioni, costoETempo, SOGLIE_C10 } from './asticella-c10.js';

const CLASSI = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c10', 'c11', 'c12', 'c13'];
const S = (ok) => (ok === null || ok === undefined ? '⚪' : ok ? '🟢' : '🔴');
const cella = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');
const hhmm = (iso) => { const q = iso ? giornoEMinuti(iso) : null; return q ? `${String(Math.floor(q.minuti / 60)).padStart(2, '0')}:${String(q.minuti % 60).padStart(2, '0')}` : '—'; };
const vere = (c) => (c.tours || []).flatMap(t => t.stops || []).filter(s => !s.tempoLibero);

export function reportC10(raw, config, meta = {}) {
    const casi = raw.casi.filter(c => !c.errore && !c.saltato);
    const byId = new Map(casi.map(c => [c.id, c]));
    const baseSec = meta.baseSec ?? null;
    const L = [];
    const righe = casi.map(c => {
        const costo = costoUsd(c, config.prezziUsd).totale;
        return { c, conosce: conosceCitta(c), piena: giornataPiena(c), ct: costoETempo(c, costo, baseSec), ctrl: eseguiControlli({ ...c, orari: c.orari || {} }, config) };
    });
    const sintesi = { casi: raw.casi.length, misurati: casi.length, spesa: raw.costo?.totale ?? 0, classi: {} };
    for (const k of CLASSI) sintesi.classi[k] = righe.reduce((a, r) => a + (r.ctrl[k]?.violazioni.length || 0), 0);

    // ── 1. tour × voci ──
    L.push('## Tour × voci dell\'asticella');
    L.push('');
    L.push(`Soglie: conosce la città ≥ ${SOGLIE_C10.ancoreMin} essenziali della lista di controllo nel tour e ≥ ${SOGLIE_C10.visiteDallaListaMin * 100}% delle visite dalla lista verificata (borgo: ≥ ${SOGLIE_C10.borgoDallaListaMin} posti della lista); giornata piena ≤ ${SOGLIE_C10.tempoLiberoMax} min di tempo libero; costo primo tour della città nel giorno ≤ ${SOGLIE_C10.costoPrimoMax.toFixed(2).replace('.', ',')} $, gli altri ≤ ${SOGLIE_C10.costoAltriMax.toFixed(2).replace('.', ',')} $; tempo ≤ ${baseSec ?? '?'} s + ${SOGLIE_C10.tempoPeggioreMaxSec} s.`);
    L.push('');
    L.push('| Tour | Tappe | Conosce la città | Essenziali nel tour | Visite dalla lista | Giornata piena (tempo libero) | Lista | Costo | Tempo |');
    L.push('|---|---|---|---|---|---|---|---|---|');
    for (const { c, conosce, piena, ct } of righe) {
        const ess = conosce.applicabile ? (conosce.essenziali || []).join(', ') || '—' : '—';
        const vis = conosce.applicabile ? (conosce.borgo ? `${(conosce.dallaLista || []).length} posti della lista` : `${conosce.visiteDallaLista}/${conosce.visite}`) : '—';
        L.push(`| ${c.id} | ${vere(c).length} | ${S(conosce.applicabile ? conosce.ok : null)} | ${cella(ess)} | ${vis} | ${S(piena.applicabile ? piena.ok : null)} ${piena.minuti ?? '—'} min | ${c.citta ? (c.citta.cached ? 'dal server' : '**nuova**') : '—'} | ${S(ct.okCosto)} ${usd(ct.costo)} | ${S(ct.okTempo)} ${c.secs?.toFixed?.(1) ?? '—'} s |`);
    }
    L.push('');
    // su misura
    L.push('**Su misura** (profili A e B, stessa città: almeno metà delle tappe diverse)');
    L.push('');
    L.push('| Città | Tappe A | Tappe B | In comune | Diverse | Esito | In comune |');
    L.push('|---|---|---|---|---|---|---|');
    for (const l of ['catania', 'roma']) {
        const a = byId.get(`c10-${l}-a`), b = byId.get(`c10-${l}-b`);
        if (!a || !b) { L.push(`| ${l} | — | — | — | — | ⚪ | caso mancante |`); continue; }
        const m = suMisura(a, b);
        L.push(`| ${a.luogo} | ${m.tappeA} | ${m.tappeB} | ${m.comuni} | ${Math.round(m.diverse * 100)}% | ${S(m.ok)} | ${cella(m.nomiComuni.join(', ')) || '—'} |`);
    }
    L.push('');
    // invenzioni, per lista
    L.push('**Invenzioni** (nomi proposti dall\'AI che Google non verifica; indicatore, obiettivo sotto il 20%)');
    L.push('');
    L.push('| Città | Proposti | Verificati | Scartati | Quota | Esito |');
    L.push('|---|---|---|---|---|---|');
    const liste = new Map();
    for (const c of casi) if (c.citta?.conti && !liste.has(c.luogo)) liste.set(c.luogo, c.citta.conti);
    for (const [citta, conti] of liste) {
        const v = invenzioni(conti);
        L.push(`| ${citta} | ${conti.proposti} | ${conti.verificati} | ${conti.scartati} | ${Math.round(v.quota * 100)}% | ${S(v.ok)} |`);
    }
    L.push('');

    // ── 2. costo per città-giorno ──
    L.push('## Costo per tour e per città-giorno');
    L.push('');
    L.push('| Città | Primo tour (con la lista nuova) | Altri tour (lista dal server) | Città-giorno (lista + tour del giro) |');
    L.push('|---|---|---|---|');
    for (const citta of [...new Set(casi.map(c => c.luogo))]) {
        const cc = righe.filter(r => r.c.luogo === citta);
        const primo = cc.find(r => r.ct.primo);
        const altri = cc.filter(r => !r.ct.primo);
        const tot = cc.reduce((a, r) => a + r.ct.costo, 0);
        L.push(`| ${citta} | ${primo ? `${usd(primo.ct.costo)} (${primo.c.id})` : '—'} | ${altri.length ? altri.map(r => `${usd(r.ct.costo)} (${r.c.id})`).join(', ') : '—'} | ${usd(tot)} |`);
    }
    L.push('');
    L.push(`Totale del giro: **${usd(raw.costo?.totale ?? 0)}** (listino del banco: token + Google, foto non caricate; le chiamate che il server fa per la lista sono contate allo stesso listino). Chiamate Google della lista servite dalla cache del proxy: ${casi.reduce((a, c) => a + (c.googleListaHit || 0), 0)}.`);
    L.push('');

    // ── 3. i controlli di sempre ──
    L.push('## I controlli di sempre (c1–c13, invariati)');
    L.push('');
    L.push('| Tour | ' + CLASSI.join(' | ') + ' |');
    L.push('|---|' + CLASSI.map(() => '---').join('|') + '|');
    for (const { c, ctrl } of righe) L.push(`| ${c.id} | ${CLASSI.map(k => (ctrl[k]?.applicabile === false ? '⚪' : `${S(ctrl[k].violazioni.length === 0)}${ctrl[k].violazioni.length || ''}`)).join(' | ')} |`);
    L.push('');
    const viol = righe.flatMap(r => CLASSI.flatMap(k => (r.ctrl[k]?.violazioni || []).map(v => `- **${r.c.id}** (${k}) — ${v.testo}`)));
    if (viol.length) { L.push('Violazioni:'); L.push(''); L.push(...viol); L.push(''); }

    // ── 4. i testi, tour per tour ──
    L.push('## I tour, col testo che vede l\'utente');
    L.push('');
    for (const c of casi) {
        L.push(`### ${c.id} — ${c.richiesta}${c.profilo ? ` (profilo ${c.profilo})` : ''}`);
        L.push('');
        const anc = new Set((c.citta?.ancore || []).map(a => a.place_id));
        const ids = new Set((c.citta?.verificati || []).map(x => x.place_id));
        for (const s of (c.tours || []).flatMap(t => t.stops || [])) {
            const tag = s.tempoLibero ? '' : anc.has(s.place_id) ? ' ⚓ ancora' : ids.has(s.place_id) ? ' · lista' : '';
            L.push(`- ${hhmm(s.at)} **${cella(s.title)}**${s.moment ? ` (${s.moment})` : ''}${tag}: ${s.tempoLibero ? `Tempo libero (${s.stay} min). ` : ''}${cella(s.description)}`);
        }
        L.push('');
    }
    return { markdown: L.join('\n'), sintesi, righe };
}
