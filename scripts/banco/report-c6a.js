// C6a — il giro con famiglie, durate e nomi decisi dal tipo principale, contro il giro ORARI (la regola degli orari, prima di C6a).
// Stessa ricerca, stessi 30 casi, stessa ora simulata. Funzione pura: due grezzi in, markdown e numeri fuori.
// c5 e c6 sono misurate con lo STESSO codice su entrambi i giri (il c6 classifica dal tipo principale, indipendente dal motore).
import { misuraCaso } from './misure.js';
import { sezioneVoci, sezioneCosto, n1, usd } from './sezioni.js';
import { eseguiControlli } from './controlli.js';
import { NOMI_MODO, MODI } from './casi-esteso.js';
import { KINDS, kindFromPrimaryType } from '../../src/lib/placeKind.js';

const analizza = (raw, config) => new Map((raw.casi || []).map(c => [c.id, {
    c, m: misuraCaso(c, config), ctrl: eseguiControlli({ ...c, orari: c.orari || {} }, config),
}]));
const tappeReali = (c) => (c.tours || []).flatMap(t => t.stops || []).filter(s => !s.tempoLibero);
const MUSEO_PT = /(^|_)museum$|^art_gallery$/;
const somma = (xs) => xs.reduce((a, b) => a + b, 0);

export function reportC6a(base, nuovo, config, meta = {}) {
    const B = analizza(base, config), N = analizza(nuovo, config);
    const ids = (nuovo.casi || []).map(c => c.id);
    const L = [];
    const ctrl = (X, id, k) => X.get(id)?.ctrl?.[k];
    const tot = (X, k) => somma(ids.map(id => ctrl(X, id, k)?.violazioni.length || 0));
    const casi = (X, k) => ids.filter(id => ctrl(X, id, k)?.violazioni.length).length;
    const stops = (X) => ids.flatMap(id => (X.get(id)?.c ? tappeReali(X.get(id).c) : []));
    const sB = stops(B), sN = stops(N);

    // ── c6: esercitata davvero? ──
    const esercitate = (X) => ids.reduce((m, id) => { for (const [k, n] of Object.entries(ctrl(X, id, 'c6')?.esercitate || {})) m[k] = (m[k] || 0) + n; return m; }, {});
    const eB = esercitate(B), eN = esercitate(N);
    const caffeBarN = sN.filter(s => KINDS[kindFromPrimaryType(s.primaryType)] && ['bar', 'caffe', 'forno', 'dolce'].includes(kindFromPrimaryType(s.primaryType)));

    // ── famiglie ──
    const famMuseoStorta = (S) => S.filter(s => s.famiglia === 'museo' && s.primaryType && !MUSEO_PT.test(s.primaryType));
    const famCount = (S) => S.reduce((m, s) => { const k = s.famiglia || '—'; m[k] = (m[k] || 0) + 1; return m; }, {});

    // ── nomi ──
    const conBarra = (S) => S.filter(s => /\|/.test(s.title || ''));
    const frasiTolte = (X) => somma(ids.map(id => (Array.isArray(X.get(id)?.c?.frasiTolte) ? X.get(id).c.frasiTolte.length : 0)));
    const rinominati = sN.filter(s => s.nomeOriginale);

    const sintesi = {
        c6: { prima: tot(B, 'c6'), dopo: tot(N, 'c6'), casiPrima: casi(B, 'c6'), casiDopo: casi(N, 'c6') },
        c5: { prima: tot(B, 'c5'), dopo: tot(N, 'c5'), casiPrima: casi(B, 'c5'), casiDopo: casi(N, 'c5') },
        caffeBarEsercitati: caffeBarN.length, esercitateDopo: eN, esercitatePrima: eB,
        museoStorti: { prima: famMuseoStorta(sB).length, dopo: famMuseoStorta(sN).length },
        nomiConBarra: { prima: conBarra(sB).length, dopo: conBarra(sN).length }, rinominati: rinominati.length,
        frasiTolte: { prima: frasiTolte(B), dopo: frasiTolte(N) },
        spesa: usd(nuovo.costo?.totale),
    };

    L.push('# C6a — famiglie giuste, durate giuste, nomi puliti (dal tipo principale)');
    L.push('');
    L.push(`Giro con C6a: \`${meta.nuovoNome || '?'}\`, motore \`${meta.commit || '?'}\`, \`engine=new\` (solo l'account di prova), ora simulata ${config.esteso.giornoSimulato}. `
        + `Contro: \`${meta.baseNome || '?'}\`, lo stesso giro dopo ORARI e prima di C6a. ${ids.length} casi. `
        + 'c5 e c6 sono misurate sui due giri con lo stesso codice del banco (c6 classifica ogni tappa dal tipo principale di Google, senza usare il motore): '
        + '«prima» è quindi il giro ORARI misurato con il righello nuovo, non con quello vecchio.');
    L.push('');

    // ── c6 ──
    L.push('## c6 — durate uguali per tipi diversi');
    L.push('');
    L.push(`**Prima ${sintesi.c6.prima} violazioni in ${sintesi.c6.casiPrima} casi → dopo ${sintesi.c6.dopo} violazioni in ${sintesi.c6.casiDopo} casi.**`);
    L.push('');
    const fmt = (m) => Object.entries(m).sort().map(([k, n]) => `${k} ${n}`).join(', ') || '—';
    L.push(`**Esercitata davvero?** Tappe controllate dopo C6a per tipo di sosta: ${fmt(eN)} (prima: ${fmt(eB)}). Caffè, bar, forni e gelaterie nel giro dopo C6a, dal tipo principale: **${caffeBarN.length}**`
        + (caffeBarN.length ? ` (${caffeBarN.map(s => `${s.title} [${s.primaryType}, ${s.stay} min]`).join('; ')}).` : ' — nessuno: c6 non ha controllato un caffè o un bar, il verde non conta.'));
    L.push('');
    const violN = ids.flatMap(id => (ctrl(N, id, 'c6')?.violazioni || []).map(v => `${id}: ${v.testo}`));
    const violB = ids.flatMap(id => (ctrl(B, id, 'c6')?.violazioni || []).map(v => `${id}: ${v.testo}`));
    if (violB.length) { L.push('Violazioni di c6 prima (il giro ORARI, righello nuovo):'); L.push(''); for (const v of violB) L.push(`- ${v}`); L.push(''); }
    if (violN.length) { L.push('Violazioni di c6 dopo:'); L.push(''); for (const v of violN) L.push(`- ${v}`); L.push(''); }

    L.push('### Tabella tipo principale → minuti, osservata nelle tappe finali');
    L.push('');
    L.push('| Tipo principale | Tipo del posto (C6a) | Minuti attesi | Tappe prima | Soste prima (min) | Tappe dopo | Soste dopo (min) |');
    L.push('|---|---|---|---|---|---|---|');
    const perTipo = (S) => S.reduce((m, s) => { const k = s.primaryType || '(manca)'; const e = m.get(k) || { n: 0, st: new Map() }; e.n++; e.st.set(s.stay, (e.st.get(s.stay) || 0) + 1); m.set(k, e); return m; }, new Map());
    const tB = perTipo(sB), tN = perTipo(sN);
    const chiavi = [...new Set([...tB.keys(), ...tN.keys()])].sort((a, b) => ((tN.get(b)?.n || 0) + (tB.get(b)?.n || 0)) - ((tN.get(a)?.n || 0) + (tB.get(a)?.n || 0)));
    const stTxt = (e) => (e ? [...e.st.entries()].sort((a, b) => a[0] - b[0]).map(([m, n]) => `${m}×${n}`).join(', ') : '—');
    for (const k of chiavi) {
        const kind = kindFromPrimaryType(k);
        L.push(`| ${k} | ${kind || 'dai types / generico'} | ${kind ? KINDS[kind].minuti : '30 (generico)'} | ${tB.get(k)?.n || 0} | ${stTxt(tB.get(k))} | ${tN.get(k)?.n || 0} | ${stTxt(tN.get(k))} |`);
    }
    L.push('');

    // ── famiglie ──
    L.push('## Famiglie');
    L.push('');
    L.push(`Famiglia delle tappe finali — prima: ${fmt(famCount(sB))}; dopo: ${fmt(famCount(sN))}.`);
    L.push('');
    L.push(`Tappe con famiglia «museo» ma tipo principale che non è un museo né una galleria: prima **${sintesi.museoStorti.prima}**, dopo **${sintesi.museoStorti.dopo}**`
        + (famMuseoStorta(sN).length ? ` (${famMuseoStorta(sN).map(s => `${s.title} [${s.primaryType}]`).join('; ')})` : '') + '.');
    L.push('');
    const bar = (S) => S.filter(s => ['bar', 'caffe'].includes(kindFromPrimaryType(s.primaryType)));
    L.push(`Bar e caffè (dal tipo principale) nelle tappe finali: prima ${bar(sB).length}, dopo ${bar(sN).length}; con la sosta di un pasto (75 min): prima ${bar(sB).filter(s => s.stay >= 60).length}, dopo ${bar(sN).filter(s => s.stay >= 60).length}.`);
    L.push('');

    // ── nomi ──
    L.push('## Nomi');
    L.push('');
    L.push(`Titoli con una barra « | » nelle tappe finali: prima **${sintesi.nomiConBarra.prima}**, dopo **${sintesi.nomiConBarra.dopo}**. Tappe con il nome ripulito (originale nel tracciato): **${rinominati.length}**`
        + (rinominati.length ? ` (${rinominati.map(s => `«${s.nomeOriginale}» → «${s.title}»`).join('; ')}).` : '.'));
    L.push('');
    L.push(`Frasi tolte dal narratore (controlli di luce/ora, parole, oggetti, voce) sull'insieme dei casi: prima **${sintesi.frasiTolte.prima}**, dopo **${sintesi.frasiTolte.dopo}**.`);
    L.push('');

    // ── c5 ──
    L.push('## c5 — il controllo orari con la durata nuova');
    L.push('');
    L.push(`**Prima ${sintesi.c5.prima} violazioni in ${sintesi.c5.casiPrima} casi → dopo ${sintesi.c5.dopo} violazioni in ${sintesi.c5.casiDopo} casi.** Orario sconosciuto dopo: ${somma(ids.map(id => ctrl(N, id, 'c5')?.sconosciuti || 0))} tappe (prima ${somma(ids.map(id => ctrl(B, id, 'c5')?.sconosciuti || 0))}).`);
    L.push('');
    L.push('| Modalità | Casi | c6 prima | c6 dopo | c5 prima | c5 dopo |');
    L.push('|---|---|---|---|---|---|');
    for (const modo of MODI) {
        const sel = ids.filter(id => N.get(id)?.c.modo === modo && N.get(id)?.ctrl);
        const v = (X, k) => somma(sel.map(id => ctrl(X, id, k)?.violazioni.length || 0));
        L.push(`| ${NOMI_MODO[modo]} | ${sel.length} | ${v(B, 'c6')} | ${v(N, 'c6')} | ${v(B, 'c5')} | ${v(N, 'c5')} |`);
    }
    L.push('');
    const diff = ids.filter(id => B.get(id)?.m && N.get(id)?.m && (B.get(id).m.tappe !== N.get(id).m.tappe));
    L.push(`Casi in cui cambia il numero di tappe: ${diff.map(id => `${id} ${B.get(id).m.tappe}→${N.get(id).m.tappe}`).join(', ') || 'nessuno'}.`);
    L.push('');

    sintesi.vociPeggiorate = sezioneVoci(B, N, ids, config, L);
    sezioneCosto(B, N, ids, nuovo, config, L, { etichettaPrima: 'Giro ORARI', etichettaDopo: 'Con C6a', tetto: Number(process.env.BANCO_TETTO) || config.esteso.tettoC6aUsd });

    const ko = [...N.values()].filter(x => x.c.errore || x.c.saltato);
    if (ko.length) {
        L.push('## Casi non misurati');
        L.push('');
        for (const x of ko) L.push(`- ${x.c.id}: ${x.c.saltato ? `non girato — ${x.c.saltato}` : `errore — ${x.c.errore}`}`);
        L.push('');
    }
    return { markdown: L.join('\n'), sintesi };
}
