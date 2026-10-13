// CONTINUITA' — il giro con i buchi riempiti o dichiarati, contro il giro C6a degli stessi casi
// (stesso giorno simulato, stessa ricerca: cambia solo il motore). c11 e' misurata sui DUE giri con lo stesso
// controllo del banco (codice indipendente dal motore), cosi' il "prima" e' un numero, non un ricordo.
// Funzione pura: due grezzi (e, per il caso Catania, il grezzo di prima) in, markdown e numeri fuori.
import { misuraCaso } from './misure.js';
import { sezioneVoci, sezioneCosto, usd } from './sezioni.js';
import { eseguiControlli } from './controlli.js';
import { NOMI_MODO, MODI } from './casi-esteso.js';
import { giornoEMinuti } from './orari.js';

const analizza = (raw, config, soloIds) => new Map((raw.casi || []).filter(c => !soloIds || soloIds.includes(c.id)).map(c => [c.id, {
    c, m: misuraCaso(c, config), ctrl: eseguiControlli({ ...c, orari: c.orari || {} }, config),
}]));
const righe = (c) => (c.tours || []).flatMap(t => t.stops || []);
const reali = (c) => righe(c).filter(s => !s.tempoLibero);
const libere = (c) => righe(c).filter(s => s.tempoLibero);
const somma = (xs) => xs.reduce((a, b) => a + b, 0);
const hhmm = (iso) => { const q = iso ? giornoEMinuti(iso) : null; return q ? `${String(Math.floor(q.minuti / 60)).padStart(2, '0')}:${String(q.minuti % 60).padStart(2, '0')}` : '—'; };
const cella = (v) => (v ? `🔴 ${v}` : '🟢 0');

/** Le righe di un giro come testo: orario, sosta, tappa o tempo libero. */
const elenco = (c) => righe(c).map(s => `${hhmm(s.at)}${s.tempoLibero ? ` (${s.stay ?? 0} min)` : ''} ${s.tempoLibero ? '**tempo libero**' : s.title}`).join(' → ');

export function reportContinuita(base, nuovo, config, meta = {}) {
    const idsNuovo = (nuovo.casi || []).map(c => c.id);
    const idsBase = new Set((base.casi || []).map(c => c.id));
    const ids = idsNuovo.filter(id => idsBase.has(id));          // i casi in comune col giro di prima
    const extra = idsNuovo.filter(id => !idsBase.has(id));       // il caso Catania 13:48 (non c'era)
    const N = analizza(nuovo, config);
    const B = analizza(base, config, ids);
    const L = [];
    const c11 = (M, id) => M.get(id)?.ctrl?.c11;
    const misurati = ids.filter(id => N.get(id)?.ctrl && B.get(id)?.ctrl);
    const tot = (M, f) => somma(misurati.map(id => f(M.get(id).c)));

    const sintesi = {
        casi: ids.length, extra: extra.length,
        c11: {
            prima: somma(misurati.map(id => c11(B, id)?.violazioni.length || 0)),
            dopo: somma(misurati.map(id => c11(N, id)?.violazioni.length || 0)),
            casiPrima: misurati.filter(id => c11(B, id)?.violazioni.length).length,
            casiDopo: misurati.filter(id => c11(N, id)?.violazioni.length).length,
            applicabiliDopo: misurati.filter(id => c11(N, id)?.applicabile).length,
            extraDopo: somma(extra.map(id => c11(N, id)?.violazioni.length || 0)),
        },
        senzaOrario: { prima: somma(misurati.map(id => c11(B, id)?.senzaOrario || 0)), dopo: somma(misurati.map(id => c11(N, id)?.senzaOrario || 0)) },
        c5: { prima: somma(misurati.map(id => B.get(id).ctrl.c5.violazioni.length)), dopo: somma(ids.map(id => N.get(id)?.ctrl?.c5.violazioni.length || 0)) },
        tappe: { prima: tot(B, c => reali(c).length), dopo: tot(N, c => reali(c).length) },
        tempoLibero: { prima: tot(B, c => libere(c).length), dopo: tot(N, c => libere(c).length), minutiDopo: tot(N, c => somma(libere(c).map(s => s.stay || 0))) },
        spesa: usd(nuovo.costo?.totale),
    };

    L.push('# CONTINUITA\' — nessun buco nella giornata, ogni tappa con il suo orario');
    L.push('');
    L.push(`Giro con i buchi riempiti o dichiarati: \`${meta.nuovoNome || '?'}\`, motore \`${meta.commit || '?'}\`, \`engine=new\` (solo l'account di prova), giorno simulato **${nuovo.giornoSimulato}**`
        + `${extra.length ? ` (il caso ${extra.join(', ')} ha il suo: martedì 13/10)` : ''}. Contro: \`${meta.baseNome || '?'}\` (C6a), gli stessi ${ids.length} casi, stesso giorno simulato (${base.giornoSimulato}). `
        + 'c11 è misurata sui due giri con lo stesso controllo del banco, indipendente dal motore: fra due voci consecutive di un giro (tappe e righe di tempo libero) il tempo non coperto da sosta e cammino non supera 45 minuti, e ogni tappa vera ha il suo orario.');
    L.push('');

    L.push('## c11 — buchi non dichiarati oltre 45 minuti, tappe senza orario');
    L.push('');
    L.push(`**Prima ${sintesi.c11.prima} violazioni in ${sintesi.c11.casiPrima} casi → dopo ${sintesi.c11.dopo} in ${sintesi.c11.casiDopo} casi** (${sintesi.c11.applicabiliDopo} casi misurati: Per Te non si applica). `
        + `Tappe senza orario: ${sintesi.senzaOrario.prima} → ${sintesi.senzaOrario.dopo}.`);
    L.push('');
    L.push('| Caso | Modalità | Tappe prima→dopo | Righe di tempo libero prima→dopo | Tappe aggiunte al buco | c11 prima | c11 dopo | Senza orario (dopo) |');
    L.push('|---|---|---|---|---|---|---|---|');
    for (const id of [...ids, ...extra]) {
        const n = N.get(id); const b = B.get(id);
        if (!n?.ctrl) { L.push(`| ${id} | ${n?.c?.modo || ''} | non misurato: ${n?.c?.errore || n?.c?.saltato} | | | | | |`); continue; }
        const k = c11(N, id); const kb = c11(B, id);
        const ag = n.c.continuita?.aggiunte?.length;
        L.push(`| ${id} | ${NOMI_MODO[n.c.modo]} | ${b ? reali(b.c).length : '—'}→${reali(n.c).length} | ${b ? libere(b.c).length : '—'}→${libere(n.c).length} | ${ag ?? '—'} | ${b ? (kb?.applicabile ? cella(kb.violazioni.length) : '⚪') : 'n.d.'} | ${k?.applicabile ? cella(k.violazioni.length) : '⚪'} | ${k?.senzaOrario ?? '—'} |`);
    }
    L.push('');
    L.push('| Modalità | Casi | c11 prima | c11 dopo |');
    L.push('|---|---|---|---|');
    for (const modo of MODI) {
        const sel = misurati.filter(id => N.get(id).c.modo === modo);
        if (!sel.length) continue;
        L.push(`| ${NOMI_MODO[modo]} | ${sel.length} | ${somma(sel.map(id => c11(B, id)?.violazioni.length || 0))} | ${somma(sel.map(id => c11(N, id)?.violazioni.length || 0))} |`);
    }
    L.push('');
    L.push(`Tappe vere: ${sintesi.tappe.prima} → ${sintesi.tappe.dopo}. Righe di tempo libero: ${sintesi.tempoLibero.prima} → ${sintesi.tempoLibero.dopo} (in tutto ${sintesi.tempoLibero.minutiDopo} minuti dichiarati con la loro fascia).`);
    L.push('');

    for (const id of extra) {
        const n = N.get(id);
        if (!n) continue;
        L.push(`## Il caso di Ivano — ${id}`);
        L.push('');
        const prima = meta.prima?.casi?.find(c => c.id === id);
        if (prima) { L.push(`**Prima** (\`${meta.primaNome}\`): ${elenco(prima)}`); L.push(''); }
        L.push(`**Dopo:** ${elenco(n.c)}`);
        L.push('');
        L.push(`c11 dopo: ${n.ctrl ? n.ctrl.c11.violazioni.length : 'non misurato'} violazioni${n.ctrl?.c11.violazioni.length ? ` — ${n.ctrl.c11.violazioni.map(v => v.testo).join('; ')}` : ''}.`);
        L.push('');
    }

    L.push('## c5 resta 0 — posti chiusi all\'ora della tappa');
    L.push('');
    L.push(`c5 sui ${ids.length} casi: ${sintesi.c5.prima} → **${sintesi.c5.dopo}** violazioni.`);
    L.push('');

    sintesi.vociPeggiorate = sezioneVoci(B, N, ids, config, L, { titolo: 'Le 12 voci dell\'asticella: casi rossi, C6a contro CONTINUITA\'' });
    sezioneCosto(B, N, ids, nuovo, config, L, { etichettaPrima: 'C6a (stessi casi)', etichettaDopo: 'Con la continuità', tetto: Number(process.env.BANCO_TETTO) || config.esteso.tettoContinuitaUsd });

    const ko = [...N.values()].filter(x => x.c.errore || x.c.saltato);
    if (ko.length) { L.push('## Casi non misurati'); L.push(''); for (const x of ko) L.push(`- ${x.c.id}: ${x.c.saltato ? `non girato — ${x.c.saltato}` : `errore — ${x.c.errore}`}`); L.push(''); }
    return { markdown: L.join('\n'), sintesi };
}
