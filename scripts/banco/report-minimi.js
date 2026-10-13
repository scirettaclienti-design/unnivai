// C8b — minimi di tappe, cena tardi, Per Te nelle sue ore. I giri nuovi (piu' file: il tetto di spesa e' del task, non del giro)
// contro il "prima" di ogni caso (il grezzo piu' recente che lo contiene: C8a per la sera, C7 per il giorno).
// Le classi sono misurate con gli STESSI controlli sui due giri (quelli di adesso), indipendenti dal motore.
// Funzione pura: grezzi in, markdown e numeri fuori.
import { misuraCaso, costoUsd } from './misure.js';
import { sezioneVoci, usd, n1 } from './sezioni.js';
import { eseguiControlli, minimoPerFinestra } from './controlli.js';
import { NOMI_MODO, CASI_ESTESI } from './casi-esteso.js';
import { giroInRiga } from './report-sera.js';
import { giornoEMinuti } from './orari.js';

export const CLASSI_MINIMI = ['c1', 'c2', 'c3', 'c4', 'c5', 'c10', 'c11', 'c12', 'c13'];
const NOME_K = { c1: 'c1 pasti fuori fascia (anche Per Te)', c2: 'c2 ristorante a mattina/pomeriggio', c3: 'c3 colazione sbagliata', c4: 'c4 sotto il minimo senza ripiego',
    c5: 'c5 posto chiuso', c10: 'c10 vincolo vegetariano', c11: 'c11 buco/tappa senza orario', c12: 'c12 zona come tappa', c13: 'c13 sera' };

/** Unisce piu' grezzi dello stesso task: il caso piu' recente (ultimo file) vince; la spesa si somma. */
export function unisciGrezzi(raws) {
    const casi = new Map();
    for (const r of raws) for (const c of r.casi || []) casi.set(c.id, { ...c, _file: r._nome });
    const spesa = raws.reduce((a, r) => a + (r.costo?.totale || 0), 0);
    return { casi: [...casi.values()], spesa, giornoSimulato: raws[0]?.giornoSimulato, motore: raws[0]?.motore, file: raws.map(r => ({ nome: r._nome, spesa: r.costo?.totale || 0, casi: (r.casi || []).length })) };
}

const analizza = (casi, config, ids) => new Map(casi.filter(c => !ids || ids.includes(c.id)).map(c => [c.id, { c, m: misuraCaso(c, config), ctrl: eseguiControlli({ ...c, orari: c.orari || {} }, config) }]));
const righe = (c) => (c.tours || []).flatMap(t => t.stops || []);
const reali = (c) => righe(c).filter(s => !s.tempoLibero);
const somma = (xs) => xs.reduce((a, b) => a + b, 0);
const media = (xs) => (xs.length ? somma(xs) / xs.length : null);
const chiuso = (c) => c.source === 'closed-now';
const serale = (c) => { const h = Number(String(c.ora).split(':')[0]); return h >= 18 || h < 5; };
const hhmm = (iso) => { const q = iso ? giornoEMinuti(iso) : null; return q ? `${String(Math.floor(q.minuti / 60)).padStart(2, '0')}:${String(q.minuti % 60).padStart(2, '0')}` : '—'; };
const costoGen = (c, config) => { const x = costoUsd(c, config.prezziUsd); return x.totale - x.foto; };
const ricerche = (c) => (c.google?.['place/textsearch#new'] || 0) + (c.google?.['place/textsearch'] || 0);
const famiglieDi = (m) => m?.famiglie ?? null;

export function reportMinimi(baseCasi, nuovo, config, meta = {}) {
    const ids = CASI_ESTESI.map(c => c.id).filter(id => nuovo.casi.some(c => c.id === id));
    const N = analizza(nuovo.casi, config, ids);
    const B = analizza(baseCasi, config, ids);
    const misurati = ids.filter(id => N.get(id)?.ctrl);
    const confrontabili = misurati.filter(id => B.get(id)?.ctrl);
    const nonGirati = CASI_ESTESI.filter(c => !ids.includes(c.id)).map(c => c.id);
    const ctrl = (M, id, k) => M.get(id)?.ctrl?.[k];
    const tot = (M, lista, k) => somma(lista.map(id => ctrl(M, id, k)?.violazioni.length || 0));
    const L = [];
    const sintesi = { casi: ids.length, misurati: misurati.length, nonGirati: nonGirati.length, classi: {}, spesa: usd(nuovo.spesa), spesaNum: nuovo.spesa, peggioramenti: [], costoPerModo: {} };
    for (const k of CLASSI_MINIMI) sintesi.classi[k] = { prima: tot(B, confrontabili, k), dopo: tot(N, misurati, k), casiDopo: misurati.filter(id => ctrl(N, id, k)?.violazioni.length).length };

    L.push('# C8b — minimi di tappe, cena tardi, Per Te nelle sue ore');
    L.push('');
    L.push(`Codice: \`${meta.commit || '?'}\`, \`engine=new\` (solo l'account di prova), giorno simulato **${nuovo.giornoSimulato}** (mercoledì), ora simulata per caso. `
        + `${ids.length} casi girati su ${CASI_ESTESI.length}${nonGirati.length ? ` (${nonGirati.length} non girati per il tetto di spesa, elencati in fondo)` : ''}. `
        + 'Il "prima" di ogni caso viene dal grezzo più recente che lo contiene (C8a per la sera, C7 per il giorno; i file sono elencati in fondo). '
        + 'Le classi sono misurate sui due giri con gli **stessi controlli** (quelli di adesso: c1 ora vale anche per Per Te, c4 usa il minimo della durata), indipendenti dal motore. '
        + 'Un campione per caso: il pool di Google cambia da una chiamata all\'altra.');
    L.push('');
    if (meta.diagnosi) { L.push(meta.diagnosi.trim()); L.push(''); }

    // ── casi × classi ──
    L.push('## Casi × classi');
    L.push('');
    L.push(`| Caso | Modalità | Ora | Tappe | ${CLASSI_MINIMI.join(' | ')} |`);
    L.push(`|---|---|---|---|${CLASSI_MINIMI.map(() => '---').join('|')}|`);
    for (const id of ids) {
        const n = N.get(id);
        if (!n) continue;
        if (n.c.errore || n.c.saltato) { L.push(`| ${id} | ${NOMI_MODO[n.c.modo]} | ${n.c.ora} | non misurato: ${n.c.errore || n.c.saltato} |${CLASSI_MINIMI.map(() => ' ').join('|')}|`); continue; }
        const cl = (k) => { const x = n.ctrl[k]; return !x?.applicabile ? '⚪' : x.violazioni.length ? `🔴 ${x.violazioni.length}` : '🟢 0'; };
        const nt = (n.c.tours || []).map(t => (t.stops || []).filter(s => !s.tempoLibero).length).join('+');
        L.push(`| ${id} | ${NOMI_MODO[n.c.modo]} | ${n.c.ora} | ${chiuso(n.c) ? 'messaggio' : nt}${righe(n.c).some(s => s.tempoLibero) ? ' (+tempo libero)' : ''} | ${CLASSI_MINIMI.map(cl).join(' | ')} |`);
    }
    L.push('');
    L.push('| Classe | Violazioni prima (casi confrontabili) | Violazioni dopo (tutti i casi misurati) | Casi rossi dopo |');
    L.push('|---|---|---|---|');
    for (const k of CLASSI_MINIMI) { const x = sintesi.classi[k]; L.push(`| ${NOME_K[k]} | ${x.prima} | **${x.dopo}** | ${x.casiDopo} |`); }
    L.push('');

    // ── i giri, caso per caso ──
    L.push('## I giri, caso per caso');
    L.push('');
    for (const id of ids) {
        const n = N.get(id); const b = B.get(id);
        if (!n?.c || n.c.errore || n.c.saltato) continue;
        L.push(`### ${id} — ${n.c.luogo} ${n.c.ora}${n.c.richiesta && n.c.modo === 'crea' ? `, «${String(n.c.richiesta).slice(0, 80)}»` : ''}`);
        L.push('');
        L.push(`- **Prima** (${b?.c?._file || b?.c?.codice || 'giro precedente'}): ${b && !b.c.errore ? (n.c.modo === 'perte' ? (b.c.tours || []).map(t => `[${t.tema}: ${(t.stops || []).map(s => s.title).join(' → ')}]`).join(' ') : giroInRiga(b.c)) : '*(nessun grezzo di prima per questo caso)*'}`);
        L.push(`- **Dopo**: ${n.c.modo === 'perte' && !n.c.serale ? (n.c.tours || []).map(t => `[${t.tema}: ${(t.stops || []).map(s => `${hhmm(s.at)} ${s.title}`).join(' → ')}]`).join(' ') : giroInRiga(n.c)}`);
        const fin = n.c.finestraMinuti;
        if (fin) L.push(`- Finestra ${fin.map(m => `${Math.round(m / 60 * 10) / 10} h`).join(', ')} → minimo ${fin.map(m => minimoPerFinestra(m, config)).join(', ')} tappe; tappe vere ${(n.c.tours || []).map(t => (t.stops || []).filter(s => !s.tempoLibero).length).join(', ')}${n.c.continuita?.minimo?.aggiunte?.length ? `; aggiunte per il minimo: ${n.c.continuita.minimo.aggiunte.length}` : ''}${n.c.continuita?.minimo?.dichiarati?.length ? `; dichiarate: ${n.c.continuita.minimo.dichiarati.length}` : ''}.`);
        const tl = righe(n.c).filter(s => s.tempoLibero).map(s => `«${(s.description || '').slice(0, 120)}»`);
        if (tl.length) L.push(`- Testo che vede l'utente (tempo libero): ${tl.join(' · ')}`);
        L.push('');
    }

    // ── residui ──
    const residue = ids.flatMap(id => CLASSI_MINIMI.flatMap(k => (ctrl(N, id, k)?.violazioni || []).map(v => ({ id, k, v, c: N.get(id).c }))));
    L.push('## Violazioni rimaste, con il testo che vede l\'utente');
    L.push('');
    if (!residue.length) L.push('Nessuna: tutte le classi misurate sono a 0 sui casi girati.');
    else {
        L.push('| Caso | Classe | Momento | Cosa | Cosa vede l\'utente |');
        L.push('|---|---|---|---|---|');
        for (const { id, k, v, c } of residue) {
            const s = righe(c).find(x => x.title === v.tappa);
            const visto = s ? `«${s.title}»${s.description ? ` — «${String(s.description).slice(0, 100)}»` : ''}` : ((c.schermo?.note || [])[0] || '—');
            L.push(`| ${id} | ${k} | ${v.momento || '—'} | ${v.testo} | ${visto} |`);
        }
    }
    L.push('');

    // ── regressione diurna ──
    const diurni = confrontabili.filter(id => !serale(N.get(id).c));
    L.push('## Regressione dei casi diurni: C7 → C8b');
    L.push('');
    if (!diurni.length) L.push('Nessun caso diurno confrontabile in questo giro.');
    else {
        L.push('| Caso | Tappe vere | Famiglie | Percorso (km · incroci · esito) | Costo del caso | Peggioramenti |');
        L.push('|---|---|---|---|---|---|');
        for (const id of diurni) {
            const n = N.get(id).m; const b = B.get(id).m;
            const nv = n.tappe - n.tempoLibero; const bv = b.tappe - b.tempoLibero;
            const cb = b.costo.token + b.costo.google; const cn = n.costo.token + n.costo.google;
            const p = [];
            if (nv < bv) p.push(`tappe ${bv}→${nv}`);
            if (famiglieDi(n) < famiglieDi(b)) p.push(`famiglie ${famiglieDi(b)}→${famiglieDi(n)}`);
            if (b.percorso && n.percorso) {
                if (b.percorso.ok && !n.percorso.ok) p.push('percorso 🟢→🔴');
                if (n.percorso.km > b.percorso.km * 1.2 && n.percorso.km - b.percorso.km > 0.5) p.push(`km ${b.percorso.km}→${n.percorso.km}`);
            }
            if (cn > cb * 1.25 && cn - cb > 0.03) p.push(`costo ${usd(cb)}→${usd(cn)}`);
            if (n.ripetizioni > b.ripetizioni) p.push(`ripetizioni ${b.ripetizioni}→${n.ripetizioni}`);
            for (const x of p) sintesi.peggioramenti.push({ id, x });
            const per = (m) => (m.percorso ? `${m.percorso.km} · ${m.percorso.incroci} · ${m.percorso.ok ? '🟢' : '🔴'}` : '—');
            L.push(`| ${id} | ${bv}→${nv} | ${famiglieDi(b)}→${famiglieDi(n)} | ${per(b)} → ${per(n)} | ${usd(cb)}→${usd(cn)} | ${p.length ? '🔴 ' + p.join('; ') : '🟢 nessuno'} |`);
        }
        L.push('');
        L.push(sintesi.peggioramenti.length
            ? `**Peggioramenti elencati (${sintesi.peggioramenti.length}):** ${sintesi.peggioramenti.map(p => `${p.id}: ${p.x}`).join(' · ')}.`
            : '**Nessun peggioramento** su tappe vere, famiglie, percorso, ripetizioni e costo nei casi diurni girati.');
    }
    L.push('');
    const bAll = confrontabili;
    sintesi.vociPeggiorate = sezioneVoci(B, N, bAll, config, L, { titolo: 'Le 12 voci dell\'asticella: casi rossi, prima contro dopo (casi confrontabili)' });

    // ── costo ──
    L.push('## Costo medio per generazione, per modalità');
    L.push('');
    L.push('| Modalità | Casi | Costo medio (token + Google, senza foto) | Ricerche di testo | Chiamate AI | Secondi |');
    L.push('|---|---|---|---|---|---|');
    for (const modo of ['crea', 'veloce', 'sorprendimi', 'perte']) {
        const xs = misurati.map(id => N.get(id).c).filter(c => c.modo === modo);
        if (!xs.length) continue;
        const cg = media(xs.map(c => costoGen(c, config)));
        sintesi.costoPerModo[modo] = cg;
        L.push(`| ${NOMI_MODO[modo]} | ${xs.length} | ${usd(cg)} | ${n1(media(xs.map(ricerche)))} | ${n1(media(xs.map(c => c.ai?.chiamate || 0)))} | ${n1(media(xs.map(c => c.secs)))} |`);
    }
    L.push('');
    const cb = media(confrontabili.map(id => costoGen(B.get(id).c, config))); const cn = media(confrontabili.map(id => costoGen(N.get(id).c, config)));
    L.push(`Sugli stessi ${confrontabili.length} casi confrontabili: prima ${usd(cb)}, dopo ${usd(cn)}${cb && cn ? ` (${cn - cb >= 0 ? '+' : ''}${n1(((cn - cb) / cb) * 100)}%)` : ''} a generazione. `
        + `**Spesa del task: ${usd(nuovo.spesa)}** su un tetto di ${usd(config.esteso.tettoMinimiUsd)} (ci si ferma a ${usd(config.esteso.tettoMinimiUsd * 0.9)}). File: ${nuovo.file.map(f => `${f.nome} ${usd(f.spesa)}`).join(', ')}.`);
    L.push('');

    if (nonGirati.length) { L.push('## Casi non girati in questo task (tetto di spesa)'); L.push(''); L.push(nonGirati.map(id => `\`${id}\``).join(', ') + '.'); L.push(''); }
    const ko = [...N.values()].filter(x => x.c.errore || x.c.saltato);
    if (ko.length) { L.push('## Casi non misurati'); L.push(''); for (const x of ko) L.push(`- ${x.c.id}: ${x.c.saltato ? `non girato — ${x.c.saltato}` : `errore — ${x.c.errore}`}`); L.push(''); }
    return { markdown: L.join('\n'), sintesi };
}
