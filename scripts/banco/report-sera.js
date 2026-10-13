// C8a — la sera e il Veloce. Il giro nuovo contro i giri di prima degli STESSI casi serali (un "prima" per caso,
// preso dal grezzo piu' recente che lo contiene). Le classi sono misurate sui due giri con gli stessi controlli
// (quelli di adesso), indipendenti dal motore: il "prima" e' un numero, non un ricordo.
// Funzione pura: due grezzi in, markdown e numeri fuori.
import { misuraCaso, costoUsd } from './misure.js';
import { sezioneVoci, sezioneCosto, usd, n1 } from './sezioni.js';
import { eseguiControlli, tipoSosta } from './controlli.js';
import { NOMI_MODO } from './casi-esteso.js';
import { giornoEMinuti } from './orari.js';

export const CASI_SERA = [
    'veloce-catania-relax-2125', 'veloce-catania-relax-2145', 'veloce-catania-relax-2330',
    'crea-napoli-aperitivo-cena', 'crea-catania-1800', 'perte-catania-1900', 'veloce-siracusa-parco',
];
export const CLASSI_SERA = ['c1', 'c4', 'c5', 'c11', 'c13'];
const NOME_K = { c1: 'c1 — pasti fuori fascia', c4: 'c4 — meno di 4 tappe senza ripiego (la sera: drink + cena, o drink + passeggiata)', c5: 'c5 — posto chiuso',
    c11: 'c11 — buco / tappa senza orario', c13: 'c13 — sera: drink corto, secondo bar o buco senza passeggiata' };

const analizza = (raw, config, soloIds) => new Map((raw.casi || []).filter(c => !soloIds || soloIds.includes(c.id)).map(c => [c.id, {
    c, m: misuraCaso(c, config), ctrl: eseguiControlli({ ...c, orari: c.orari || {} }, config),
}]));
const righe = (c) => (c.tours || []).flatMap(t => t.stops || []);
const reali = (c) => righe(c).filter(s => !s.tempoLibero);
const somma = (xs) => xs.reduce((a, b) => a + b, 0);
const hhmm = (iso) => { const q = iso ? giornoEMinuti(iso) : null; return q ? `${String(Math.floor(q.minuti / 60)).padStart(2, '0')}:${String(q.minuti % 60).padStart(2, '0')}` : '—'; };
const chiuso = (c) => c.source === 'closed-now';
const NOMI_TIPO = { pasto: 'ristorante', caffe: 'bar/caffè', museo: 'museo', chiesa: 'chiesa', verde: 'verde', altro: 'luogo' };
const tipoTesto = (s) => (s.tempoLibero ? 'tempo libero' : (s.primaryType ? s.primaryType.replace(/_/g, ' ') : (NOMI_TIPO[tipoSosta(s)] || 'luogo')));

/** Il giro come una riga: "21:45 Bar X (60') → 22:50 Piazza Y (30')". */
export const giroInRiga = (c) => {
    if (chiuso(c)) return '*(nessun giro: messaggio)*';
    const r = righe(c);
    if (!r.length) return '*(nessuna tappa)*';
    return r.map(s => (s.tempoLibero ? `*tempo libero ${hhmm(s.at)} (${s.stay} min)*` : `${hhmm(s.at)} ${s.title}${s.passeggiata ? ' 🚶' : ''} (${s.stay ?? '?'}')`)).join(' → ');
};
/** I buchi del giro: minuti di buco non dichiarati (c11) e righe di tempo libero. */
const buchi = (ctrl) => {
    const c = ctrl?.c11;
    if (!c?.applicabile) return 'n.a.';
    return `${c.violazioni.length} non dichiarati · ${c.righeTempoLibero ?? 0} righe`;
};
/** Il testo che vede l'utente: il messaggio, oppure il titolo del tour e la descrizione della passeggiata. */
const testoUtente = (c) => {
    if (chiuso(c)) return (c.schermo?.note || [])[0] || c.chiusoOra || '«quasi tutto chiuso»';
    const t = c.schermo?.giorni?.[0]?.titolo;
    const walk = reali(c).find(s => s.passeggiata);
    return [t ? `titolo «${t}»` : null, walk?.description ? `passeggiata: «${walk.description.slice(0, 110)}${walk.description.length > 110 ? '…' : ''}»` : null].filter(Boolean).join(' · ') || '—';
};

export function reportSera(base, nuovo, config, meta = {}) {
    const ids = CASI_SERA.filter(id => (nuovo.casi || []).some(c => c.id === id));
    const N = analizza(nuovo, config, ids);
    const B = analizza(base, config, ids);
    const ctrl = (M, id, k) => M.get(id)?.ctrl?.[k];
    const misurati = ids.filter(id => N.get(id)?.ctrl);
    const confrontabili = misurati.filter(id => B.get(id)?.ctrl);
    const tot = (M, lista, k) => somma(lista.map(id => ctrl(M, id, k)?.violazioni.length || 0));
    const casi = (M, lista, k) => lista.filter(id => ctrl(M, id, k)?.violazioni.length).length;
    const L = [];
    const sintesi = { casi: ids.length, misurati: misurati.length, classi: {}, spesa: usd(nuovo.costo?.totale), chiusiConPoolAperto: [], messaggi: [] };
    for (const k of CLASSI_SERA) sintesi.classi[k] = { prima: tot(B, confrontabili, k), dopo: tot(N, misurati, k), casiDopo: casi(N, misurati, k), casiPrima: casi(B, confrontabili, k) };

    L.push('# C8a — la sera e il Veloce');
    L.push('');
    L.push(`Giro nuovo: \`${meta.nuovoNome || '?'}\`, motore \`${meta.commit || '?'}\`, \`engine=new\` (solo l'account di prova), giorno simulato **${nuovo.giornoSimulato}** (mercoledì), ora simulata per caso. `
        + `Il "prima" di ogni caso viene dal grezzo più recente che lo contiene (${meta.baseNome || '?'}); i casi nuovi (crea-catania-1800) sono stati girati sul codice di prima (\`ce135b5\`) per avere un confronto vero. `
        + 'Le classi sono misurate sui due giri con gli **stessi controlli** (quelli di adesso, c4 estesa e c13 nuova, entrambe validate), indipendenti dal motore. '
        + 'Un campione per caso: il pool di Google cambia da una chiamata all\'altra.');
    L.push('');
    if (meta.diagnosi) { L.push(meta.diagnosi.trim()); L.push(''); }

    L.push('## Prima e dopo, caso per caso');
    L.push('');
    L.push('| Caso | Modalità | Ora | Tappe prima→dopo | Buchi (dopo) | Fonte prima→dopo | Girato col codice |');
    L.push('|---|---|---|---|---|---|---|');
    for (const id of ids) {
        const n = N.get(id); const b = B.get(id);
        if (!n) continue;
        if (n.c.errore || n.c.saltato) { L.push(`| ${id} | ${NOMI_MODO[n.c.modo]} | ${n.c.ora} | non misurato: ${n.c.errore || n.c.saltato} | | | |`); continue; }
        L.push(`| ${id} | ${NOMI_MODO[n.c.modo]} | ${n.c.ora} | ${b && !b.c.errore ? reali(b.c).length : '—'}→${reali(n.c).length} | ${buchi(n.ctrl)} | ${b?.c?.source || '—'}→${n.c.source} | ${n.c.codice === 'finale' ? '**finale**' : (n.c.codice || 'finale')} |`);
    }
    L.push('');
    for (const id of ids) {
        const n = N.get(id); const b = B.get(id);
        if (!n?.c || n.c.errore || n.c.saltato) continue;
        L.push(`### ${id} — ${n.c.luogo} ${n.c.ora}${n.c.richiesta ? `, «${String(n.c.richiesta).slice(0, 80)}»` : ''}`);
        L.push('');
        L.push('| | Tappe, orari e durate | Testo che vede l\'utente |');
        L.push('|---|---|---|');
        L.push(`| **Prima**${b?.c?.motore ? '' : ''} | ${b && !b.c.errore ? giroInRiga(b.c) : '*(nessun grezzo di prima per questo caso)*'} | ${b && !b.c.errore ? testoUtente(b.c) : '—'} |`);
        const interm = (nuovo.rigiro || []).find(x => x.id === id)?.caso;
        if (interm) L.push(`| **Dopo, primo giro** (versione intermedia del codice) | ${giroInRiga(interm)} | ${testoUtente(interm)} |`);
        L.push(`| **Dopo${interm ? ', codice finale' : ''}** | ${giroInRiga(n.c)} | ${testoUtente(n.c)} |`);
        L.push('');
        if (!chiuso(n.c)) {
            L.push('| Ora | Momento | Tappa | Che posto è | Sosta |');
            L.push('|---|---|---|---|---|');
            for (const s of righe(n.c)) L.push(`| ${hhmm(s.at)} | ${s.moment || '—'}${s.passeggiata ? ' (passeggiata)' : ''} | ${s.tempoLibero ? '*Tempo libero*' : s.title} | ${tipoTesto(s)} | ${s.stay ?? '—'} min |`);
            L.push('');
        }
        // "quasi tutto chiuso" davanti a un pool con locali aperti?
        if (chiuso(n.c)) {
            const chiusi = n.c.orariMotore?.chiusi?.length ?? 0;
            const visti = n.c.candidatiVisti ?? null;
            sintesi.messaggi.push({ id, chiusi, visti });
            L.push(`Messaggio dichiarato: ${chiusi} posti chiusi su ${visti ?? '?'} visti; nessun locale aperto per tutta la sosta nel pool. Controllo da fare a mano sulla cache dei posti (vedi sotto).`);
            L.push('');
        }
    }

    L.push('## Le classi sui casi serali');
    L.push('');
    L.push(`Casi misurati: ${misurati.length} (${confrontabili.length} con un "prima" misurabile).`);
    L.push('');
    L.push('| Classe | Prima (violazioni / casi) | Dopo (violazioni / casi) |');
    L.push('|---|---|---|');
    for (const k of CLASSI_SERA) {
        const x = sintesi.classi[k];
        L.push(`| ${NOME_K[k]} | ${x.prima} / ${x.casiPrima} | **${x.dopo} / ${x.casiDopo}** |`);
    }
    L.push('');
    L.push('| Caso | c1 | c4 | c5 | c11 | c13 |');
    L.push('|---|---|---|---|---|---|');
    for (const id of ids) {
        const n = N.get(id); const b = B.get(id);
        if (!n?.ctrl) continue;
        const cl = (k) => {
            const x = n.ctrl[k]; if (!x?.applicabile) return '⚪';
            const y = b?.ctrl?.[k];
            return `${x.violazioni.length ? '🔴' : '🟢'} ${x.violazioni.length}${y?.applicabile && y.violazioni.length !== x.violazioni.length ? ` (era ${y.violazioni.length})` : ''}`;
        };
        L.push(`| ${id} | ${CLASSI_SERA.map(cl).join(' | ')} |`);
    }
    L.push('');
    const residue = ids.flatMap(id => CLASSI_SERA.flatMap(k => (ctrl(N, id, k)?.violazioni || []).map(v => ({ id, k, v }))));
    L.push('### Violazioni rimaste');
    L.push('');
    if (!residue.length) L.push('Nessuna: c1, c4, c5, c11 e c13 sono a 0 su tutti i casi serali misurati.');
    else {
        L.push('| Caso | Classe | Momento | Cosa |');
        L.push('|---|---|---|---|');
        for (const { id, k, v } of residue) L.push(`| ${id} | ${k} | ${v.momento || '—'} | ${v.testo} |`);
    }
    L.push('');

    // la ricerca mirata e il costo della sera
    L.push('## Ricerche mirate e costo dei tour serali');
    L.push('');
    L.push('| Caso | Ricerche mirate (prima della scelta) | Dopo la scelta | Ricerche di testo | Costo del tour |');
    L.push('|---|---|---|---|---|');
    for (const id of ids) {
        const n = N.get(id); if (!n?.c || n.c.errore || n.c.saltato) continue;
        const cos = costoUsd(n.c, config.prezziUsd);
        const ts = (n.c.google?.['place/textsearch#new'] || 0) + (n.c.google?.['place/textsearch'] || 0);
        L.push(`| ${id} | ${(n.c.ricerche?.prima || []).join(', ') || '—'} | ${(n.c.ricerche?.dopo || []).map(x => x.tema).join(', ') || '—'} | ${ts} | ${usd(cos.totale - cos.foto)} |`);
    }
    L.push('');

    sintesi.vociPeggiorate = sezioneVoci(B, N, confrontabili, config, L, { titolo: 'Le 12 voci dell\'asticella: casi rossi, prima contro dopo (casi serali)' });
    sezioneCosto(B, N, confrontabili, nuovo, config, L, { etichettaPrima: 'Prima (stessi casi)', etichettaDopo: 'Con C8a', tetto: Number(process.env.BANCO_TETTO) || config.esteso.tettoSeraUsd });
    const media = (xs) => (xs.length ? somma(xs) / xs.length : null);
    L.push(`Costo medio per generazione dei casi serali: **${usd(media(misurati.map(id => { const x = costoUsd(N.get(id).c, config.prezziUsd); return x.totale - x.foto; })))}** (token + Google, senza foto); ricerche di testo per generazione: ${n1(media(misurati.map(id => (N.get(id).c.google?.['place/textsearch#new'] || 0) + (N.get(id).c.google?.['place/textsearch'] || 0))))}. `
        + `Spesa del giro: **${usd(nuovo.costo?.totale)}** (tetto ${usd(Number(process.env.BANCO_TETTO) || config.esteso.tettoSeraUsd)}).`);
    L.push('');

    const ko = [...N.values()].filter(x => x.c.errore || x.c.saltato);
    if (ko.length) { L.push('## Casi non misurati'); L.push(''); for (const x of ko) L.push(`- ${x.c.id}: ${x.c.saltato ? `non girato — ${x.c.saltato}` : `errore — ${x.c.errore}`}`); L.push(''); }
    return { markdown: L.join('\n'), sintesi };
}
