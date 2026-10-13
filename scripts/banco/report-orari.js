// ORARI — il giro con la regola degli orari, contro il giro `new` di prima della regola
// (stessa ricerca, stessi 30 casi, stessa ora simulata). Funzione pura: due grezzi in, markdown e numeri fuori.
import { misuraCaso, semafori, VOCI } from './misure.js';
import { eseguiControlli } from './controlli.js';
import { NOMI_MODO, MODI } from './casi-esteso.js';
import { VARIANZA_CASI } from './confronto-places.js';

const n1 = (x) => (x === null || x === undefined || Number.isNaN(x) ? '—' : String(Math.round(x * 10) / 10).replace('.', ','));
const usd = (x) => (x === null || x === undefined ? '—' : `$${x.toFixed(3).replace('.', ',')}`);
const cella = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const NOMI_VOCE = { verita: 'Verità', voce: 'Voce', distanze: 'Distanze', ripetizioni: 'Ripetizioni', vincoli: 'Vincoli', inComune: 'In comune A/B',
    famosita: 'Famosità', giornata: 'Giornata', tempo: 'Tempo', costo: 'Costo', destinazione: 'Destinazione', percorso: 'Percorso (C5c)', catene: 'Catene' };

const analizza = (raw, config) => new Map((raw.casi || []).map(c => [c.id, {
    c, m: misuraCaso(c, config), ctrl: eseguiControlli({ ...c, orari: c.orari || {} }, config),
}]));
const tappeReali = (c) => (c.tours || []).flatMap(t => t.stops || []).filter(s => !s.tempoLibero);
const righeDichiarate = (c) => (c.tours || []).flatMap(t => t.stops || []).filter(s => s.tempoLibero);

export function reportOrari(base, nuovo, config, meta = {}) {
    const B = analizza(base, config), N = analizza(nuovo, config);
    const ids = (nuovo.casi || []).map(c => c.id);
    const L = [];
    const c5 = (X, id) => X.get(id)?.ctrl?.c5;
    const sommaC5 = (X, f) => ids.reduce((a, id) => a + (c5(X, id) ? f(c5(X, id)) : 0), 0);

    const sintesi = {
        c5: {
            prima: sommaC5(B, x => x.violazioni.length), dopo: sommaC5(N, x => x.violazioni.length),
            casiPrima: ids.filter(id => c5(B, id)?.violazioni.length).length, casiDopo: ids.filter(id => c5(N, id)?.violazioni.length).length,
        },
        spesa: usd(nuovo.costo?.totale),
    };

    L.push('# ORARI — ogni tappa aperta all\'ora in cui ci arrivi (con la ricerca nuova)');
    L.push('');
    L.push(`Giro con la regola: \`${meta.nuovoNome || '?'}\`, motore \`${meta.commit || '?'}\`, \`engine=new\` (solo l'account di prova), ora simulata ${config.esteso.giornoSimulato}. `
        + `Contro: \`${meta.baseNome || '?'}\`, lo stesso giro con la ricerca nuova ma **senza** la regola (MIG-PLACES). `
        + `${ids.length} casi${(nuovo.casi || []).some(c => c.saltato || c.errore) ? ', alcuni non misurati (vedi in fondo)' : ''}. `
        + 'c5 è misurata qui con la regola nuova: il posto deve essere aperto per **tutta la sosta** (arrivo → arrivo + durata), non solo all\'arrivo; il controllo è indipendente da quello del motore (campiona ogni 5 minuti gli orari settimanali di Google).');
    L.push('');

    // ── c5 ──
    L.push('## c5 — posti chiusi quando ci si arriva');
    L.push('');
    L.push(`**Prima ${sintesi.c5.prima} violazioni in ${sintesi.c5.casiPrima} casi → dopo ${sintesi.c5.dopo} violazioni in ${sintesi.c5.casiDopo} casi.**`);
    L.push('');
    L.push('| Caso | Modalità | Tappe prima→dopo | c5 prima | c5 dopo (all\'arrivo / oltre la chiusura) | Orario sconosciuto (dopo) | Righe dichiarate | Messaggio |');
    L.push('|---|---|---|---|---|---|---|---|');
    for (const id of ids) {
        const n = N.get(id), b = B.get(id);
        if (!n?.ctrl) { L.push(`| ${id} | ${n?.c?.modo || ''} | non misurato: ${cella(n?.c?.errore || n?.c?.saltato)} | | | | | |`); continue; }
        const dich = righeDichiarate(n.c).map(s => (s.pasto || /locale aperto/i.test(s.description || '') ? 'pasto: nessun locale aperto' : 'tempo libero')).join(', ') || '—';
        L.push(`| ${id} | ${NOMI_MODO[n.c.modo]} | ${b?.m ? b.m.tappe : '—'}→${n.m.tappe} | ${b?.ctrl ? b.ctrl.c5.violazioni.length : '—'} | ${n.ctrl.c5.violazioni.length ? '🔴' : '🟢'} ${n.ctrl.c5.violazioni.length} (${n.ctrl.c5.chiuseAllArrivo} / ${n.ctrl.c5.oltreChiusura}) | ${n.ctrl.c5.sconosciuti} | ${dich} | ${n.c.chiusoOra ? '«' + n.c.chiusoOra + '»' : '—'} |`);
    }
    L.push('');
    L.push('### Per modalità');
    L.push('');
    L.push('| Modalità | Casi | c5 prima (violazioni / casi) | c5 dopo (violazioni / casi) | Tappe con orario sconosciuto (dopo) |');
    L.push('|---|---|---|---|---|');
    for (const modo of MODI) {
        const sel = ids.filter(id => N.get(id)?.c.modo === modo && N.get(id)?.ctrl);
        const v = (X) => sel.reduce((a, id) => a + (X.get(id)?.ctrl?.c5.violazioni.length || 0), 0);
        const k = (X) => sel.filter(id => X.get(id)?.ctrl?.c5.violazioni.length).length;
        L.push(`| ${NOMI_MODO[modo]} | ${sel.length} | ${v(B)} / ${k(B)} | ${v(N)} / ${k(N)} | ${sel.reduce((a, id) => a + tappeReali(N.get(id).c).filter(s => s.orario === 'sconosciuto').length, 0)} |`);
    }
    L.push('');

    // ── Orari sconosciuti ──
    const sconosciuteTracciato = ids.reduce((a, id) => a + (N.get(id)?.c ? tappeReali(N.get(id).c).filter(s => s.orario === 'sconosciuto').length : 0), 0);
    const tappeTotali = ids.reduce((a, id) => a + (N.get(id)?.c ? tappeReali(N.get(id).c).length : 0), 0);
    const conOrario = ids.reduce((a, id) => a + (N.get(id)?.c ? tappeReali(N.get(id).c).filter(s => s.orario === 'noto').length : 0), 0);
    L.push('## Orario sconosciuto');
    L.push('');
    L.push(`Tappe finali: **${tappeTotali}**; orario **noto** (aperto per tutta la sosta, segnato nel tracciato): **${conOrario}**; **sconosciuto**: **${sconosciuteTracciato}** `
        + `(prima: ${ids.reduce((a, id) => a + (B.get(id)?.ctrl ? B.get(id).ctrl.c5.sconosciuti : 0), 0)} contate dal banco). `
        + 'L\'orario sconosciuto è ammesso: Google non ha gli orari di quel posto, o la ricerca era quella vecchia.');
    L.push('');

    // ── Cosa ha fatto il motore ──
    L.push('## Cosa ha fatto il motore');
    L.push('');
    L.push('| Caso | Posti/tappe chiusi tolti | Vietati dopo il controllo sugli orari veri (momenti) | Giri di controllo | Sostituzioni | Righe dichiarate |');
    L.push('|---|---|---|---|---|---|');
    for (const id of ids) {
        const c = N.get(id)?.c;
        const o = c?.orariMotore;
        if (!o) { L.push(`| ${id} | ${c?.chiusoOra ? 'tutto chiuso → messaggio' : '—'} | | | | |`); continue; }
        const tolti = c.modo === 'perte' ? (o.chiuse || []).length : (o.chiusi || []).length;
        L.push(`| ${id} | ${tolti} | ${(o.vietati || []).reduce((a, v) => a + (Array.isArray(v.place_id) ? v.place_id.length : 0), 0)} | ${o.giri ?? '—'} | ${(o.aggiunte || []).length} | ${(o.righeDichiarate || []).length} |`);
    }
    L.push('');

    // ── c4 ──
    const c4 = (X, id) => X.get(id)?.ctrl?.c4;
    const c4B = ids.filter(id => c4(B, id)?.violazioni.length).length, c4N = ids.filter(id => c4(N, id)?.violazioni.length).length;
    const messaggi = ids.filter(id => N.get(id)?.c?.chiusoOra);
    L.push('## c4 — meno di 4 tappe senza ripiego dichiarato');
    L.push('');
    L.push(`Casi con c4 rosso: prima **${c4B}**, dopo **${c4N}**. Casi in cui il giro è diventato il messaggio dichiarato (il messaggio dichiarato): **${messaggi.length}** (${messaggi.join(', ') || 'nessuno'}) — contano come ripiego dichiarato, non come tappe mancanti. `
        + `Righe di tempo libero / «nessun locale aperto» inserite: ${ids.reduce((a, id) => a + (N.get(id)?.c ? righeDichiarate(N.get(id).c).length : 0), 0)} (prima ${ids.reduce((a, id) => a + (B.get(id)?.c ? righeDichiarate(B.get(id).c).length : 0), 0)}).`);
    L.push('');

    // ── voci ──
    L.push('## Le 12 voci dell\'asticella: casi rossi, prima contro dopo');
    L.push('');
    L.push(`Un campione per caso: la varianza dichiarata è ±${VARIANZA_CASI} casi per voce (scelta mia, non misurata). Una voce "peggiora oltre la varianza" se ha più di ${VARIANZA_CASI} casi rossi in più.`);
    L.push('');
    L.push('| Voce | Rossi prima | Rossi dopo | Δ | Esito |');
    L.push('|---|---|---|---|---|');
    const tieni = ids.filter(id => B.get(id)?.m && N.get(id)?.m);
    const rosse = (X, v) => tieni.filter(id => semafori(X.get(id).m, X.get(id).c, config, null)?.[v] === 'rosso');
    let peggiorate = 0;
    for (const v of VOCI) {
        const a = rosse(B, v), b = rosse(N, v), d = b.length - a.length;
        if (d > VARIANZA_CASI) peggiorate++;
        L.push(`| ${NOMI_VOCE[v]} | ${a.length} | ${b.length} | ${d > 0 ? '+' : ''}${d} | ${d > VARIANZA_CASI ? '🔴 PEGGIORATA' : d > 0 ? '🟡 entro la varianza' : '🟢 invariata o migliore'}${d !== 0 ? ` (nuovi rossi: ${b.filter(x => !a.includes(x)).join(', ') || '—'}; tornati verdi: ${a.filter(x => !b.includes(x)).join(', ') || '—'})` : ''} |`);
    }
    sintesi.vociPeggiorate = peggiorate;
    L.push('');
    L.push('Percorso (misura C5c) per caso, dove cambia: ' + (ids.filter(id => B.get(id)?.m?.percorso && N.get(id)?.m?.percorso && B.get(id).m.percorso.ok !== N.get(id).m.percorso.ok)
        .map(id => `${id} ${B.get(id).m.percorso.ok ? '🟢' : '🔴'}→${N.get(id).m.percorso.ok ? '🟢' : '🔴'}`).join(', ') || 'nessun cambio di verdetto') + '.');
    L.push('');

    // ── costo ──
    const costo = (X) => tieni.map(id => X.get(id).m.costo.token + X.get(id).m.costo.google);
    const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const ricerche = (X) => media(tieni.map(id => (X.get(id).c.google?.['place/textsearch#new'] || 0) + (X.get(id).c.google?.['place/textsearch'] || 0)));
    L.push('## Costo per generazione misurato');
    L.push('');
    L.push('| | Prima della regola | Con la regola | Δ |');
    L.push('|---|---|---|---|');
    const cb = media(costo(B)), cn = media(costo(N));
    L.push(`| Costo medio per generazione (token + Google contati, senza foto) | ${usd(cb)} | ${usd(cn)} | ${cb && cn ? `${cn - cb >= 0 ? '+' : ''}${usd(cn - cb)} (${n1(((cn - cb) / cb) * 100)}%)` : '—'} |`);
    L.push(`| Ricerche di testo per generazione | ${n1(ricerche(B))} | ${n1(ricerche(N))} | |`);
    L.push(`| Chiamate AI per generazione | ${n1(media(tieni.map(id => B.get(id).c.ai?.chiamate || 0)))} | ${n1(media(tieni.map(id => N.get(id).c.ai?.chiamate || 0)))} | |`);
    L.push(`| Tempo medio per generazione (s) | ${n1(media(tieni.map(id => B.get(id).m.secondi)))} | ${n1(media(tieni.map(id => N.get(id).m.secondi)))} | |`);
    L.push('');
    L.push(`Spesa del giro: **${usd(nuovo.costo?.totale)}** (tetto ${usd(config.esteso.tettoOrariUsd)}).`);
    L.push('');

    const ko = [...N.values()].filter(x => x.c.errore || x.c.saltato);
    if (ko.length) {
        L.push('## Casi non misurati');
        L.push('');
        for (const x of ko) L.push(`- ${x.c.id}: ${x.c.saltato ? `non girato — ${x.c.saltato}` : `errore — ${x.c.errore}`}`);
        L.push('');
    }
    return { markdown: L.join('\n'), sintesi };
}
