// ORARI-FESTIVI — il giro con gli orari del giorno (festivi, ferie), contro il giro C6a degli stessi casi
// (stesso motore a parte la regola; giorno simulato diverso: il confronto sulle 12 voci e' indicativo, quello sul costo no).
// Funzione pura: due grezzi in, markdown e numeri fuori.
import { misuraCaso } from './misure.js';
import { sezioneVoci, sezioneCosto, n1, usd } from './sezioni.js';
import { eseguiControlli, chiusoAllaTappa } from './controlli.js';
import { NOMI_MODO, MODI } from './casi-esteso.js';
import { coperta, dataRoma } from './orari.js';

const analizza = (raw, config, soloIds) => new Map((raw.casi || []).filter(c => !soloIds || soloIds.includes(c.id)).map(c => [c.id, {
    c, m: misuraCaso(c, config), ctrl: eseguiControlli({ ...c, orari: c.orari || {} }, config),
}]));
const tappeReali = (c) => (c.tours || []).flatMap(t => t.stops || []).filter(s => !s.tempoLibero);
const somma = (xs) => xs.reduce((a, b) => a + b, 0);

/** Gli intervalli di un posto in una data, dalla settimana e dal giorno, come testo confrontabile. */
function intervalliSettimana(periods, data) {
    const g = new Date(`${data}T00:00:00Z`).getUTCDay();
    return (periods || []).filter(p => p?.open?.day === g && p.close).map(p => `${p.open.time}-${p.close.time}`).sort().join(',');
}
function intervalliGiorno(current, data) {
    return (current?.periods || []).filter(p => p.date === data).map(p => `${p.open}-${p.close == null ? '2400' : p.close}`).sort().join(',');
}

export function reportFestivi(base, nuovo, config, meta = {}) {
    const ids = (nuovo.casi || []).map(c => c.id);
    const N = analizza(nuovo, config);
    const B = analizza(base, config, ids);
    const giorno = nuovo.giornoSimulato;
    const L = [];
    const c5 = (id) => N.get(id)?.ctrl?.c5;
    const sN = ids.flatMap(id => (N.get(id)?.c ? tappeReali(N.get(id).c) : []));

    // c5 sullo stesso giro, con la sola settimana (il righello di ORARI)
    const c5Settimana = (id) => {
        const c = N.get(id)?.c;
        if (!c) return 0;
        return tappeReali(c).filter(s => chiusoAllaTappa({ ...c, orari: c.orari || {} }, s, { sosta: true, soloSettimana: true }).chiuso).length;
    };

    // posti con orari del giorno diversi dalla settimana, nella data simulata
    const nomi = new Map();
    for (const c of nuovo.casi || []) {
        for (const v of Object.values(c.pool || {})) for (const x of (Array.isArray(v) ? v : v.candidati || [])) if (x.place_id && x.nome) nomi.set(x.place_id, x.nome);
        for (const s of tappeReali(c)) if (s.place_id) nomi.set(s.place_id, s.title);
    }
    const luoghi = Object.entries(nuovo.luoghiOrari || {});
    const conGiorno = luoghi.filter(([, o]) => o.current && coperta(o.current, giorno));
    const diversi = conGiorno.filter(([, o]) => o.periods && intervalliSettimana(o.periods, giorno) !== intervalliGiorno(o.current, giorno));
    const chiusiSoloDalGiorno = diversi.filter(([, o]) => intervalliGiorno(o.current, giorno) === '' && intervalliSettimana(o.periods, giorno) !== '');

    const sintesi = {
        giorno,
        c5: { dopo: somma(ids.map(id => c5(id)?.violazioni.length || 0)), casi: ids.filter(id => c5(id)?.violazioni.length).length },
        c5SoloSettimana: somma(ids.map(c5Settimana)),
        tappeDaGiorno: sN.filter(s => s.orarioFonte === 'orario del giorno').length,
        tappeDaSettimana: sN.filter(s => s.orarioFonte === 'orario della settimana').length,
        tappeSenzaFonte: sN.filter(s => !s.orarioFonte).length,
        postiConOrariDelGiorno: conGiorno.length, postiDiversi: diversi.length, postiChiusiSoloDalGiorno: chiusiSoloDalGiorno.length,
        postiTotali: luoghi.length, spesa: usd(nuovo.costo?.totale),
    };

    L.push('# ORARI-FESTIVI — chiusure speciali (festivi, ferie) nel controllo orari');
    L.push('');
    L.push(`Giro con gli orari del giorno: \`${meta.nuovoNome || '?'}\`, motore \`${meta.commit || '?'}\`, \`engine=new\` (solo l'account di prova), giorno simulato **${giorno}**. `
        + `Contro: \`${meta.baseNome || '?'}\` (C6a), gli stessi ${ids.length} casi senza gli orari del giorno e con un altro giorno simulato (${base.giornoSimulato}). `
        + 'c5 è misurata con codice del banco indipendente dal motore: per una data coperta dagli orari del giorno vince l\'orario del giorno (campionato ogni 5 minuti su istanti assoluti), oltre vale la settimana.');
    L.push('');

    L.push('## c5 — aperto per tutta la sosta, con gli orari del giorno');
    L.push('');
    L.push(`**${sintesi.c5.dopo} violazioni in ${sintesi.c5.casi} casi.** Lo stesso giro misurato con la sola settimana (il righello di ORARI): ${sintesi.c5SoloSettimana} violazioni.`);
    L.push('');
    L.push('| Caso | Modalità | Tappe | c5 (giorno) | c5 (solo settimana) | Tappe dall\'orario del giorno | Dall\'orario della settimana | Verdetto diverso dalla settimana | Sconosciuto |');
    L.push('|---|---|---|---|---|---|---|---|---|');
    for (const id of ids) {
        const n = N.get(id); const k = c5(id);
        if (!n?.ctrl) { L.push(`| ${id} | ${n?.c?.modo || ''} | non misurato: ${n?.c?.errore || n?.c?.saltato} | | | | | | |`); continue; }
        const st = tappeReali(n.c);
        L.push(`| ${id} | ${NOMI_MODO[n.c.modo]} | ${st.length} | ${k.violazioni.length ? '🔴' : '🟢'} ${k.violazioni.length} | ${c5Settimana(id)} | ${st.filter(s => s.orarioFonte === 'orario del giorno').length} | ${st.filter(s => s.orarioFonte === 'orario della settimana').length} | ${k.verdettoDiversoDallaSettimana} | ${k.sconosciuti} |`);
    }
    L.push('');
    L.push('| Modalità | Casi | c5 (giorno) | Tappe dall\'orario del giorno |');
    L.push('|---|---|---|---|');
    for (const modo of MODI) {
        const sel = ids.filter(id => N.get(id)?.c.modo === modo && N.get(id)?.ctrl);
        if (!sel.length) continue;
        L.push(`| ${NOMI_MODO[modo]} | ${sel.length} | ${somma(sel.map(id => c5(id).violazioni.length))} | ${somma(sel.map(id => tappeReali(N.get(id).c).filter(s => s.orarioFonte === 'orario del giorno').length))} |`);
    }
    L.push('');
    L.push(`Tracciato: tappe finali **${sN.length}** — dall'orario del giorno **${sintesi.tappeDaGiorno}**, dall'orario della settimana **${sintesi.tappeDaSettimana}**, senza fonte (orario sconosciuto) **${sintesi.tappeSenzaFonte}**.`);
    L.push('');

    L.push('## Quanti giorni speciali ha davvero trovato Google');
    L.push('');
    L.push(`Posti distinti visti dalle ricerche: **${sintesi.postiTotali}**; con gli orari del giorno che coprono ${giorno}: **${conGiorno.length}**; con orari del giorno **diversi** da quelli della settimana in quella data: **${diversi.length}** (di cui chiusi tutto il giorno solo secondo gli orari del giorno: **${chiusiSoloDalGiorno.length}**).`);
    L.push('');
    if (diversi.length) {
        L.push('| Posto | Orario della settimana | Orario del giorno |');
        L.push('|---|---|---|');
        for (const [id, o] of diversi.slice(0, 25)) L.push(`| ${nomi.get(id) || id} | ${intervalliSettimana(o.periods, giorno) || 'chiuso'} | ${intervalliGiorno(o.current, giorno) || 'chiuso'} |`);
        L.push('');
    }

    sintesi.vociPeggiorate = sezioneVoci(B, N, ids, config, L, { titolo: 'Le 12 voci dell\'asticella: casi rossi, C6a contro ORARI-FESTIVI (indicativo: giorno simulato diverso)' });
    sezioneCosto(B, N, ids, nuovo, config, L, { etichettaPrima: 'C6a (stessi casi)', etichettaDopo: 'Con gli orari del giorno', tetto: Number(process.env.BANCO_TETTO) || config.esteso.tettoFestiviUsd });

    const ko = [...N.values()].filter(x => x.c.errore || x.c.saltato);
    if (ko.length) { L.push('## Casi non misurati'); L.push(''); for (const x of ko) L.push(`- ${x.c.id}: ${x.c.saltato ? `non girato — ${x.c.saltato}` : `errore — ${x.c.errore}`}`); L.push(''); }
    return { markdown: L.join('\n'), sintesi };
}
