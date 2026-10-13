// C8c — pasti giusti: la sera si cena, la colazione chiesta c'e', un dolce solo e dopo. I casi rigirati contro il "prima" (i grezzi
// di C8b: il piu' recente che contiene il caso). Le classi sono misurate sui due giri con gli STESSI controlli (quelli di adesso),
// indipendenti dal motore. Funzione pura: grezzi in, markdown e numeri fuori.
import { misuraCaso, costoUsd, semafori } from './misure.js';
import { usd } from './sezioni.js';
import { eseguiControlli } from './controlli.js';
import { NOMI_MODO, CASI_ESTESI } from './casi-esteso.js';
import { giroInRiga } from './report-sera.js';
import { unisciGrezzi } from './report-minimi.js';
import { giornoEMinuti } from './orari.js';

export { unisciGrezzi };
export const CLASSI_PASTI = ['c1', 'c2', 'c3', 'c4', 'c5', 'c10', 'c11', 'c12', 'c13'];
const NOME_K = { c1: 'c1 pasti fuori fascia, secondo pasto, dolci', c2: 'c2 ristorante a mattina/pomeriggio', c3: 'c3 colazione sbagliata', c4: 'c4 sotto il minimo senza ripiego',
    c5: 'c5 posto chiuso', c10: 'c10 vincolo vegetariano', c11: 'c11 buco/tappa senza orario', c12: 'c12 zona come tappa', c13: 'c13 sera (anche: sera senza cena)' };

const analizza = (casi, config, ids) => new Map(casi.filter(c => !ids || ids.includes(c.id)).map(c => {
    const m = misuraCaso(c, config);
    return [c.id, { c, m, sem: m ? semafori(m, c, config) : null, ctrl: eseguiControlli({ ...c, orari: c.orari || {} }, config) }];
}));
const righe = (c) => (c.tours || []).flatMap(t => t.stops || []);
const somma = (xs) => xs.reduce((a, b) => a + b, 0);
const hhmm = (iso) => { const q = iso ? giornoEMinuti(iso) : null; return q ? `${String(Math.floor(q.minuti / 60)).padStart(2, '0')}:${String(q.minuti % 60).padStart(2, '0')}` : '—'; };
const costoGen = (c, config) => { const x = costoUsd(c, config.prezziUsd); return x.totale - x.foto; };
const lunghezza = (s) => String(s || '').replace(/\s+/g, ' ').slice(0, 130);
const SEM = { verde: '🟢', rosso: '🔴', null: '⚪', undefined: '⚪' };

/** Il giro di un caso in una riga: Per Te di giorno = un tour per tema; altrimenti l'itinerario con orari e soste. */
const giro = (c) => (c.modo === 'perte' && !c.serale
    ? (c.tours || []).map(t => `[${t.tema}: ${(t.stops || []).map(s => `${hhmm(s.at)} ${s.title}`).join(' → ')}]`).join(' ')
    : giroInRiga(c));

export function reportPasti(baseCasi, nuovo, config, meta = {}) {
    const ids = CASI_ESTESI.map(c => c.id).filter(id => nuovo.casi.some(c => c.id === id));
    const N = analizza(nuovo.casi, config, ids);
    const B = analizza(baseCasi, config, ids);
    const misurati = ids.filter(id => N.get(id)?.ctrl && !N.get(id).c.errore && !N.get(id).c.saltato);
    const confrontabili = misurati.filter(id => B.get(id)?.ctrl && !B.get(id).c.errore);
    const ctrl = (M, id, k) => M.get(id)?.ctrl?.[k];
    const tot = (M, lista, k) => somma(lista.map(id => ctrl(M, id, k)?.violazioni.length || 0));
    const sintesi = { casi: ids.length, misurati: misurati.length, classi: {}, spesa: usd(nuovo.spesa), spesaNum: nuovo.spesa, giornata: {} };
    for (const k of CLASSI_PASTI) sintesi.classi[k] = { prima: tot(B, confrontabili, k), dopo: tot(N, misurati, k), casiDopo: misurati.filter(id => ctrl(N, id, k)?.violazioni.length).length };
    const L = [];

    L.push('# C8c — pasti giusti: la sera si cena, la colazione chiesta c\'è, un dolce solo e dopo');
    L.push('');
    L.push(`Codice al momento del report: \`${meta.commit || '?'}\` (i giri dal vivo sono di commit precedenti: vedi «Spesa» e «Cosa ho dato per vero»), \`engine=new\` (solo l'account di prova), giorno simulato **${nuovo.giornoSimulato}** (mercoledì), ora simulata per caso. `
        + `${ids.length} casi girati: i 5 della diagnosi più Veloce Catania relax 21:25 come controllo della cena tardi. `
        + `Il "prima" di ogni caso è il giro di C8b (${(meta.baseFile || []).join(', ') || 'grezzi C8b'}). `
        + 'Le classi sono misurate sui due giri con gli **stessi controlli** (quelli di adesso: c1 conta anche i dolci, c13 anche la sera senza cena), indipendenti dal motore. '
        + 'Un campione per caso: il pool di Google cambia da una chiamata all\'altra.');
    L.push('');
    if (meta.diagnosi) { L.push(meta.diagnosi.trim()); L.push(''); }

    L.push('## Casi × classi (dopo)');
    L.push('');
    L.push(`| Caso | Modalità | Ora | Tappe | ${CLASSI_PASTI.join(' | ')} | Giornata |`);
    L.push(`|---|---|---|---|${CLASSI_PASTI.map(() => '---').join('|')}|---|`);
    for (const id of ids) {
        const n = N.get(id);
        if (!n) continue;
        if (n.c.errore || n.c.saltato) { L.push(`| ${id} | ${NOMI_MODO[n.c.modo]} | ${n.c.ora} | non misurato: ${n.c.errore || n.c.saltato} |${CLASSI_PASTI.map(() => ' ').join('|')}| |`); continue; }
        const cl = (k) => { const x = n.ctrl[k]; return !x?.applicabile ? '⚪' : x.violazioni.length ? `🔴 ${x.violazioni.length}` : '🟢 0'; };
        const nt = (n.c.tours || []).map(t => (t.stops || []).filter(s => !s.tempoLibero).length).join('+');
        L.push(`| ${id} | ${NOMI_MODO[n.c.modo]} | ${n.c.ora} | ${n.c.source === 'closed-now' ? 'messaggio' : nt}${righe(n.c).some(s => s.tempoLibero) ? ' (+riga)' : ''} | ${CLASSI_PASTI.map(cl).join(' | ')} | ${SEM[n.sem?.giornata]} |`);
    }
    L.push('');
    L.push('| Classe | Violazioni prima (casi confrontabili) | Violazioni dopo (tutti i casi misurati) | Casi rossi dopo |');
    L.push('|---|---|---|---|');
    for (const k of CLASSI_PASTI) { const x = sintesi.classi[k]; L.push(`| ${NOME_K[k]} | ${x.prima} | **${x.dopo}** | ${x.casiDopo} |`); }
    L.push('');

    L.push('## Prima e dopo, col testo che vede l\'utente');
    L.push('');
    for (const id of ids) {
        const n = N.get(id); const b = B.get(id);
        if (!n?.c || n.c.errore || n.c.saltato) continue;
        L.push(`### ${id} — ${n.c.luogo} ${n.c.ora}${n.c.richiesta && n.c.modo === 'crea' ? `, «${String(n.c.richiesta).slice(0, 80)}»` : ''}`);
        L.push('');
        L.push(`- **Prima** (${b?.c?._file || 'giro precedente'}): ${b && !b.c.errore ? giro(b.c) : '*(nessun giro di prima)*'}`);
        L.push(`- **Dopo**: ${giro(n.c)}`);
        const vere = righe(n.c).filter(s => !s.tempoLibero);
        const testi = [];
        for (const s of righe(n.c)) {
            if (s.tempoLibero) testi.push(`riga dichiarata (${s.moment}): «${lunghezza(s.description)}»`);
            else if (s.moment === 'cena' || s === vere[0]) testi.push(`${s.title} (${s.moment || '—'}${s.passeggiata ? ', passeggiata' : ''}): «${lunghezza(s.description)}»`);
        }
        if (testi.length) { L.push('- Testo che vede l\'utente:'); for (const t of testi) L.push(`  - ${t}`); }
        const mr = n.c.motori;
        if (mr?.facoltativiSenzaPosto?.length) L.push(`- Facoltativi senza posto: ${mr.facoltativiSenzaPosto.map(x => `${x.label}: ${x.motivo}`).join(' · ')}`);
        L.push('');
    }

    L.push('## La voce «Giornata completa» (corretta: solo finestre da 6 ore; una sera è completa con drink + cena o cena + passeggiata)');
    L.push('');
    L.push('| Caso | Finestra | Prima (regola di C8b: ≥ 4 tappe) | Dopo (regola C8c) |');
    L.push('|---|---|---|---|');
    for (const id of ids) {
        const n = N.get(id); const b = B.get(id);
        if (!n?.sem) continue;
        const fin = (n.c.finestraMinuti || []).map(m => `${Math.round(m / 60 * 10) / 10} h`).join(', ') || '—';
        const vecchia = n.c.tipo === 'itinerario' ? (n.m.tappe >= config.soglie.tappeGiornataMin ? '🟢' : '🔴') : '⚪';
        sintesi.giornata[id] = { prima: vecchia, dopo: SEM[n.sem.giornata] };
        L.push(`| ${id} | ${fin} | ${vecchia}${b?.sem ? ` (misurato allora: ${SEM[b.sem.giornata]})` : ''} | ${SEM[n.sem.giornata]} |`);
    }
    L.push('');

    const residue = ids.flatMap(id => CLASSI_PASTI.flatMap(k => (ctrl(N, id, k)?.violazioni || []).map(v => ({ id, k, v }))));
    L.push('## Violazioni rimaste');
    L.push('');
    if (!residue.length) L.push('Nessuna: c1, c2, c3, c4, c5, c10, c11, c12 e c13 sono a 0 sui casi girati.');
    else for (const r of residue) L.push(`- **${r.id}** (${r.k}): ${r.v.testo}`);
    L.push('');

    L.push('## Costo');
    L.push('');
    L.push('| Caso | Modalità | Costo del caso (token + Google, senza foto) | Ricerche di testo | Chiamate AI | Secondi |');
    L.push('|---|---|---|---|---|---|');
    const perModo = {};
    for (const id of ids) {
        const c = N.get(id)?.c;
        if (!c || c.errore || c.saltato) continue;
        const costo = costoGen(c, config);
        const ric = (c.google?.['place/textsearch#new'] || 0) + (c.google?.['place/textsearch'] || 0);
        (perModo[c.modo] ||= []).push(costo);
        L.push(`| ${id} | ${NOMI_MODO[c.modo]} | ${usd(costo)} | ${ric} | ${c.ai?.chiamate ?? '—'} | ${c.secs ?? '—'} |`);
    }
    L.push('');
    L.push('| Modalità | Casi | Costo medio per generazione |');
    L.push('|---|---|---|');
    for (const [modo, xs] of Object.entries(perModo)) { L.push(`| ${NOMI_MODO[modo]} | ${xs.length} | ${usd(somma(xs) / xs.length)} |`); sintesi[`costo_${modo}`] = somma(xs) / xs.length; }
    L.push('');
    const stessi = confrontabili.filter(id => B.get(id)?.c && !B.get(id).c.errore);
    if (stessi.length) {
        const prima = somma(stessi.map(id => costoGen(B.get(id).c, config))) / stessi.length;
        const dopo = somma(stessi.map(id => costoGen(N.get(id).c, config))) / stessi.length;
        L.push(`Sugli stessi ${stessi.length} casi confrontabili: prima ${usd(prima)}, dopo ${usd(dopo)} (${prima > 0 ? `${dopo >= prima ? '+' : ''}${Math.round((dopo / prima - 1) * 1000) / 10} %` : '—'}) a generazione. `
            + `**Spesa del giro: ${usd(nuovo.spesa)}** (tetto del task ${usd(meta.tetto)}, ci si ferma a ${usd(meta.fermo)}). File: ${nuovo.file.map(f => `${f.nome} ${usd(f.spesa)}`).join(', ')}.`);
        sintesi.costoPrima = prima; sintesi.costoDopo = dopo;
    } else L.push(`**Spesa del giro: ${usd(nuovo.spesa)}** (tetto del task ${usd(meta.tetto)}).`);
    L.push('');
    return { markdown: L.join('\n'), sintesi };
}
