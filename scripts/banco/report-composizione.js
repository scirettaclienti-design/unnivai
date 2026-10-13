// C7 — la composizione della giornata: il tema cibo solo nei pasti, un pasto per fascia, niente zone,
// "tipico". Il giro nuovo contro il giro CONTINUITA' (stessi casi, stesso giorno simulato) piu' i casi del tema.
// Le classi sono misurate sui DUE giri con gli stessi controlli (quelli di adesso): il "prima" e' un numero, non un ricordo.
// Funzione pura: due grezzi in, markdown e numeri fuori.
import { misuraCaso, costoUsd } from './misure.js';
import { sezioneVoci, sezioneCosto, usd, n1 } from './sezioni.js';
import { eseguiControlli, tipoSosta } from './controlli.js';
import { NOMI_MODO, MODI } from './casi-esteso.js';
import { giornoEMinuti } from './orari.js';

const analizza = (raw, config, soloIds) => new Map((raw.casi || []).filter(c => !soloIds || soloIds.includes(c.id)).map(c => [c.id, {
    c, m: misuraCaso(c, config), ctrl: eseguiControlli({ ...c, orari: c.orari || {} }, config),
}]));
const righe = (c) => (c.tours || []).flatMap(t => t.stops || []);
const reali = (c) => righe(c).filter(s => !s.tempoLibero);
const somma = (xs) => xs.reduce((a, b) => a + b, 0);
const hhmm = (iso) => { const q = iso ? giornoEMinuti(iso) : null; return q ? `${String(Math.floor(q.minuti / 60)).padStart(2, '0')}:${String(q.minuti % 60).padStart(2, '0')}` : '—'; };
const cella = (v) => (v == null ? '⚪' : v ? `🔴 ${v}` : '🟢 0');
const CLASSI_C7 = ['c1', 'c2', 'c3', 'c12'];
const NOMI_TIPO = { pasto: 'ristorante', caffe: 'bar/caffè', museo: 'museo', chiesa: 'chiesa', verde: 'verde', altro: 'luogo' };

/** Che posto e', in una parola, dal tipo principale (come lo vede il banco). */
const tipoTesto = (s) => (s.tempoLibero ? 'tempo libero' : (s.primaryType ? s.primaryType.replace(/_/g, ' ') : (NOMI_TIPO[tipoSosta(s)] || 'luogo')));

/** Perche' e' li': il tracciato del tema (pasto/esperienza), il tipico, il momento chiesto dal testo, chi l'ha scelto. */
const perche = (s) => {
    if (s.tempoLibero) return `${s.stay ?? 0} min`;
    const p = [];
    if (s.esplicito) p.push('chiesto dal testo');
    if (s.tema) p.push(s.tema.replace(' nello spirito del tema cibo', ' (tema)').replace('pasto del tema cibo', 'pasto del tema'));
    if (s.tipico) p.push(s.tipico.locale ? `tipico: ${s.tipico.perche}` : 'tipico: non verificabile');
    if (!p.length && s.scelta) p.push(s.scelta);
    return p.join(', ');
};

/** Il tour come lista di tappe leggibile. */
export function elencoTour(c) {
    const L = [];
    L.push('| Ora | Momento | Tappa | Che posto è | Perché è lì |');
    L.push('|---|---|---|---|---|');
    for (const s of righe(c)) {
        L.push(`| ${hhmm(s.at)} | ${s.moment || '—'} | ${s.tempoLibero ? '*Tempo libero*' : s.title} | ${tipoTesto(s)} | ${perche(s)} |`);
    }
    return L;
}

export function reportComposizione(base, nuovo, config, meta = {}) {
    const idsNuovo = (nuovo.casi || []).map(c => c.id);
    const idsBase = new Set((base.casi || []).map(c => c.id));
    const ids = idsNuovo.filter(id => idsBase.has(id));
    const extra = idsNuovo.filter(id => !idsBase.has(id));
    const N = analizza(nuovo, config);
    const B = analizza(base, config, ids);
    const L = [];
    const ctrl = (M, id, k) => M.get(id)?.ctrl?.[k];
    const misurati = ids.filter(id => N.get(id)?.ctrl && B.get(id)?.ctrl);
    const tutti = idsNuovo.filter(id => N.get(id)?.ctrl);
    const tot = (M, lista, k) => somma(lista.map(id => ctrl(M, id, k)?.violazioni.length || 0));
    const casi = (M, lista, k) => lista.filter(id => ctrl(M, id, k)?.violazioni.length).length;

    const sintesi = { casi: ids.length, extra: extra.length, classi: {}, spesa: usd(nuovo.costo?.totale) };
    for (const k of [...CLASSI_C7, 'c5', 'c11']) {
        sintesi.classi[k] = { prima: tot(B, misurati, k), dopo: tot(N, misurati, k), casiPrima: casi(B, misurati, k), casiDopo: casi(N, misurati, k), nuoviCasi: tot(N, extra, k) };
    }

    L.push('# C7 — composizione della giornata: tema solo nei pasti, un pasto per fascia, niente zone');
    L.push('');
    L.push(`Giro nuovo: \`${meta.nuovoNome || '?'}\`, motore \`${meta.commit || '?'}\`, \`engine=new\` (solo l'account di prova), giorno simulato **${nuovo.giornoSimulato}** `
        + `(il caso crea-catania-1348 ha il suo: martedì 13/10). Contro: \`${meta.baseNome || '?'}\` (CONTINUITA'), gli stessi ${ids.length} casi, stesso giorno simulato. `
        + `Più i casi nuovi del tema: ${extra.filter(id => id !== 'crea-catania-1348').join(', ') || '—'}. `
        + 'Le classi sono misurate sui due giri con gli **stessi controlli** (quelli di adesso, c1 e c2 con la soglia corretta e validata, c12 nuova), indipendenti dal motore.');
    L.push('');

    L.push('## Le classi della composizione');
    L.push('');
    L.push('| Classe | Prima (violazioni / casi) | Dopo (violazioni / casi) | Casi nuovi del tema |');
    L.push('|---|---|---|---|');
    const NOME_K = { c1: 'c1 — pasti fuori fascia', c2: 'c2 — ristorante fuori da pranzo e cena', c3: 'c3 — colazione sbagliata', c12: 'c12 — zona come tappa', c5: 'c5 — posto chiuso', c11: 'c11 — buco / tappa senza orario' };
    for (const k of [...CLASSI_C7, 'c5', 'c11']) {
        const x = sintesi.classi[k];
        L.push(`| ${NOME_K[k]} | ${x.prima} / ${x.casiPrima} | **${x.dopo} / ${x.casiDopo}** | ${x.nuoviCasi} |`);
    }
    L.push('');
    L.push(`Casi misurati: ${misurati.length} in comune col giro di prima (Per Te non si applica a c1, c2, c3, c11) + ${extra.length} nuovi.`);
    L.push('');
    L.push('| Caso | Modalità | Tappe prima→dopo | c1 | c2 | c3 | c12 | c5 | c11 |');
    L.push('|---|---|---|---|---|---|---|---|---|');
    for (const id of idsNuovo) {
        const n = N.get(id); const b = B.get(id);
        if (!n?.ctrl) { L.push(`| ${id} | ${n?.c?.modo || ''} | non misurato: ${n?.c?.errore || n?.c?.saltato} | | | | | | |`); continue; }
        const cl = (k) => {
            const x = n.ctrl[k]; if (!x?.applicabile) return '⚪';
            const y = b?.ctrl?.[k];
            return `${x.violazioni.length ? '🔴' : '🟢'} ${x.violazioni.length}${y?.applicabile && y.violazioni.length !== x.violazioni.length ? ` (era ${y.violazioni.length})` : ''}`;
        };
        L.push(`| ${id} | ${NOMI_MODO[n.c.modo]} | ${b ? reali(b.c).length : '—'}→${reali(n.c).length} | ${cl('c1')} | ${cl('c2')} | ${cl('c3')} | ${cl('c12')} | ${cl('c5')} | ${cl('c11')} |`);
    }
    L.push('');
    L.push('| Modalità | Casi | c1 prima→dopo | c2 prima→dopo | c3 prima→dopo | c12 prima→dopo |');
    L.push('|---|---|---|---|---|---|');
    for (const modo of MODI) {
        const sel = misurati.filter(id => N.get(id).c.modo === modo);
        if (!sel.length) continue;
        L.push(`| ${NOMI_MODO[modo]} | ${sel.length} | ${CLASSI_C7.map(k => `${tot(B, sel, k)}→${tot(N, sel, k)}`).join(' | ')} |`);
    }
    L.push('');

    // violazioni rimaste, con la causa
    const residue = idsNuovo.flatMap(id => CLASSI_C7.flatMap(k => (ctrl(N, id, k)?.violazioni || []).map(v => ({ id, k, v }))));
    L.push('## Violazioni rimaste');
    L.push('');
    if (!residue.length) L.push('Nessuna: c1, c2, c3 e c12 sono a 0 su tutti i casi misurati.');
    else {
        L.push('| Caso | Classe | Momento | Cosa |');
        L.push('|---|---|---|---|');
        for (const { id, k, v } of residue) L.push(`| ${id} | ${k} | ${v.momento || '—'} | ${v.testo} |`);
    }
    L.push('');

    // i tour del tema, come liste di tappe
    const TOUR = ['crea-catania-catanese', 'crea-catania-catanese-veg', 'crea-catania-1348', ...extra.filter(id => id !== 'crea-catania-1348')].filter(id => N.get(id));
    L.push('## I tour del tema, tappa per tappa');
    L.push('');
    for (const id of [...new Set(TOUR)]) {
        const n = N.get(id);
        if (!n?.c || n.c.errore || n.c.saltato) continue;
        const b = B.get(id);
        L.push(`### ${id} — ${n.c.luogo} ${n.c.ora}, «${(n.c.richiesta || '').slice(0, 90) || 'senza testo'}»${n.c.vincoli?.dieta?.length ? ` (${n.c.vincoli.dieta.join('+')})` : ''}`);
        L.push('');
        L.push(...elencoTour(n.c));
        L.push('');
        const t = n.c.tema;
        const cos = costoUsd(n.c, config.prezziUsd);
        L.push(`Tema: ${t ? `cibo=${t.cibo ? 'sì' : 'no'}, tipico=${t.tipico ? 'sì' : 'no'}${t.cucineEstereEscluse?.length ? `, cucine estere escluse: ${t.cucineEstereEscluse.join(', ')}` : ''}${t.zoneTolte?.length ? `, zone tolte: ${t.zoneTolte.map(z => z.nome).join(', ')}` : ''}` : 'n.d.'} `
            + `· ricerche mirate: ${(n.c.ricerche?.prima || []).join(', ') || '—'}${(n.c.ricerche?.dopo || []).length ? ` + dopo la scelta: ${n.c.ricerche.dopo.map(x => x.tema).join(', ')}` : ''} `
            + `· Google: ${Object.entries(n.c.google || {}).map(([k, v]) => `${k.replace('place/', '')}×${v}`).join(', ')} · **costo del tour ${usd(cos.totale - cos.foto)}** (token + Google, senza foto).`);
        L.push('');
        if (b) { L.push(`Prima (CONTINUITA'): ${righe(b.c).map(s => `${hhmm(s.at)} ${s.tempoLibero ? '*tempo libero*' : s.title}${s.pasto && !s.tempoLibero ? ' 🍽' : ''}`).join(' → ')}`); L.push(''); }
    }

    // tipico
    const tipici = idsNuovo.filter(id => N.get(id)?.c?.tema?.tipico);
    if (tipici.length) {
        L.push('## Tipico: i pasti');
        L.push('');
        L.push('| Caso | Pasti | Locali (tipo/nome) | Non verificabili | Cucine estere escluse |');
        L.push('|---|---|---|---|---|');
        for (const id of tipici) {
            const c = N.get(id).c;
            const pasti = reali(c).filter(s => s.tipico);
            L.push(`| ${id} | ${pasti.length} | ${pasti.filter(s => s.tipico.locale).length} | ${pasti.filter(s => !s.tipico.locale).length} | ${c.tema.cucineEstereEscluse?.length || 0} |`);
        }
        L.push('');
    }

    sintesi.vociPeggiorate = sezioneVoci(B, N, ids, config, L, { titolo: 'Le 12 voci dell\'asticella: casi rossi, CONTINUITA\' contro C7' });
    sezioneCosto(B, N, ids, nuovo, config, L, { etichettaPrima: 'CONTINUITA\' (stessi casi)', etichettaDopo: 'Con C7', tetto: Number(process.env.BANCO_TETTO) || config.esteso.tettoComposizioneUsd });

    // costo per tour, dei casi del tema
    const temaIds = idsNuovo.filter(id => N.get(id)?.c?.tema?.cibo && !N.get(id).c.errore);
    if (temaIds.length) {
        const media = (xs) => (xs.length ? somma(xs) / xs.length : null);
        const costoTour = (M, lista) => media(lista.filter(id => M.get(id)).map(id => { const x = costoUsd(M.get(id).c, config.prezziUsd); return x.totale - x.foto; }));
        const inBase = temaIds.filter(id => B.get(id));
        L.push('### Costo per tour dei casi a tema cibo');
        L.push('');
        L.push(`${temaIds.length} casi a tema cibo (${temaIds.join(', ')}): costo medio **${usd(costoTour(N, temaIds))}** per tour; negli stessi ${inBase.length} casi già presenti prima: ${usd(costoTour(B, inBase))} → ${usd(costoTour(N, inBase))}. `
            + `Ricerche di testo per tour: ${n1(media(temaIds.map(id => (N.get(id).c.google?.['place/textsearch#new'] || 0) + (N.get(id).c.google?.['place/textsearch'] || 0))))}.`);
        L.push('');
    }

    const ko = [...N.values()].filter(x => x.c.errore || x.c.saltato);
    if (ko.length) { L.push('## Casi non misurati'); L.push(''); for (const x of ko) L.push(`- ${x.c.id}: ${x.c.saltato ? `non girato — ${x.c.saltato}` : `errore — ${x.c.errore}`}`); L.push(''); }
    return { markdown: L.join('\n'), sintesi };
}
