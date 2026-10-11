// BANCO-NAZ — dal risultato grezzo del banco al report in markdown:
// tabella per luogo, semaforo per voce, voci rosse con gli indizi della causa,
// frasi per il controllo a mano. Funzione pura: dati in, testo fuori.
import { misuraCaso, semafori, inComune, tappeDi, VOCI } from './misure.js';
import { repeatedBrands } from '../../src/lib/routeShape.js';

const ICONA = { verde: '🟢', rosso: '🔴' };
const ic = (s) => ICONA[s] || '⚪';
const n1 = (x) => (x === null || x === undefined ? '—' : String(Math.round(x * 10) / 10).replace('.', ','));
const usd = (x) => `$${x.toFixed(3).replace('.', ',')}`;
const cella = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

const NOMI = {
    verita: 'Verità (auto)', voce: 'Voce', distanze: 'Distanze', ripetizioni: 'Ripetizioni', vincoli: 'Vincoli',
    inComune: 'In comune A/B', famosita: 'Famosità', giornata: 'Giornata completa', tempo: 'Tempo', costo: 'Costo',
    destinazione: 'Destinazione dal testo',
    percorso: 'Percorso (incroci e deviazioni)', catene: 'Catene ripetute',
};

// Gli indizi della causa, letti dai dati del caso: non una diagnosi, il primo
// posto dove guardare.
function indizi(voce, m, caso, comune, S) {
    const tappe = tappeDi(caso);
    switch (voce) {
        case 'verita': return `tappe che non passano: ${tappe.filter(s => !s.verita).map(s => s.title).join(', ')} (la rete ha tolto frasi o il testo non è pulito)`;
        case 'voce': return `frasi con problemi: ${tappe.flatMap(s => s.frasi.filter(f => f.problemi.length).map(f => `«${f.testo}» [${f.problemi.join(', ')}]`)).join('; ')}`;
        case 'distanze': {
            const lunghi = tappe.filter(s => Number.isFinite(s.min) && s.min > S.minutiCammino).map(s => `${s.title} ${s.min} min (${s.scelta || '?'}${s.motivo ? `: ${s.motivo}` : ''})`);
            return `tratti oltre ${S.minutiCammino} min: ${lunghi.join('; ')}${caso.tipo === 'perte' ? ' — Per Te non passa dalla selezione per momenti (nessun tetto di cammino)' : ''}`;
        }
        case 'ripetizioni': return `famiglie del giro: ${famiglieTesto(caso)}${m.motiviRipiego.length ? ` — ripieghi: ${m.motiviRipiego.join('; ')}` : ''}`
            + `${varietaTesto(caso) ? ` — alternative del pool: ${varietaTesto(caso)}` : ''}`;
        case 'vincoli': return m.violazioni.join('; ');
        case 'inComune': return `in comune: ${comune.titoli.join(', ')} — i due profili cambiano solo il punteggio e i vincoli del cibo; i luoghi non-cibo escono dallo stesso pool`;
        case 'famosita': return `sopra ${S.recensioniFamoso}: ${tappe.filter(s => s.recensioni > S.recensioniFamoso).map(s => `${s.title} (${s.recensioni})`).join(', ')}`;
        case 'giornata': return `${m.tappe} tappe${caso.frasiTolte?.length ? `, frasi tolte ${caso.frasiTolte.length}` : ''}; ripieghi: ${m.motiviRipiego.join('; ') || 'nessuno'} — pool povero o momenti tolti dagli orari`;
        case 'tempo': return `${n1(m.secondi)} s con ${m.chiamateAI} chiamate AI e ${m.chiamateGoogle} Google`;
        case 'costo': return `token ${usd(m.costo.token)}, Google ${usd(m.costo.google)} (${m.chiamateGoogle} chiamate), foto stimate ${usd(m.costo.foto)}`;
        case 'percorso': {
            const motivo = tappeDi(caso).map(s => s.incrocio).find(Boolean);
            const g = m.percorso.giornate.map((x, i) => `${m.percorso.giornate.length > 1 ? `giorno ${i + 1}: ` : ''}incroci ${x.incroci}, deviazioni > ${S.deviazioneMinuti} min ${x.deviazioniOltre}, max ${n1(x.deviazioneMax)} min${x.colpevole ? ` (${x.colpevole.titolo} @${x.colpevole.momento})` : ''}`).join('; ');
            const prove = tappeDi(caso).filter(s => s.deviazioneProva).map(s => `${s.title} @${s.moment} ${n1(s.deviazioneProva.minuti)} min: ${s.deviazioneProva.esito}`
                + (s.deviazioneProva.alternative[0] ? ` (la migliore alternativa: ${s.deviazioneProva.alternative[0].nome} ${n1(s.deviazioneProva.alternative[0].deviazione)} min`
                    + `${s.deviazioneProva.alternative[0].bloccata?.length ? `, bloccata da ${s.deviazioneProva.alternative[0].bloccata.join(' e ')}` : ''})` : ' (nessuna alternativa libera)')).join('; ');
            return `${g} — giro: ${percorsoTesto(caso)}${motivo ? ` — tracciato: «${motivo}»` : ''}${prove ? ` — cause: ${prove}` : ''}`;
        }
        case 'catene': return (m.percorso.giornate || []).length ? `stesso marchio: ${catene(caso)}` : '';
        case 'destinazione': return `uscito a ${m.destinazione.citta || '?'} invece di ${m.destinazione.attesa}${m.destinazione.tappeLontane.length ? `; tappe oltre ${S.destinazioneMaxKm} km: ${m.destinazione.tappeLontane.join(', ')}` : ''}`;
        default: return '';
    }
}

// C5 — il giro in una riga: tappa (momento), nell'ordine in cui si cammina.
const percorsoTesto = (caso) => (caso.tours || []).map(t => t.stops.map(s => `${s.title}${s.moment ? ` (${s.moment})` : ''}`).join(' → ')).join(' ‖ ');
// C5c — per ogni ripetizione, l'esito e le alternative del pool entro 25 min.
const varietaTesto = (caso) => tappeDi(caso).filter(s => s.varieta).map(s => `${s.title} ${s.varieta.esito}`
    + ` (${s.varieta.alternative.length ? s.varieta.alternative.map(a => `${a.nome} ${a.famiglia || 'senza famiglia'} ${a.minuti} min${a.usata ? ', gia\' nel giro' : ''}`).join(', ') : 'nessuna entro 25 min'}`
    + `${s.varieta.piuVicina ? `; la piu' vicina: ${s.varieta.piuVicina.nome} a ${s.varieta.piuVicina.minuti} min` : ''})`).join('; ');
const famiglieTesto = (caso) => (caso.tours || []).map(t => t.stops.filter(s => s.famiglia).map(s => `${s.title} (${s.famiglia})`).join(', ')).join(' ‖ ');
const catene = (caso) => (caso.tours || []).flatMap(t => repeatedBrands(t.stops)).map(c => `${c.tappe.join(' + ')} (${c.marchio})`).join('; ');

export function buildReport(raw, config, meta = {}) {
    const S = config.soglie;
    const casi = raw.casi || [];
    // In comune A/B: per luogo, la coppia b-<luogo>-A / b-<luogo>-B.
    const coppie = new Map();
    for (const c of casi.filter(c => c.gruppo === 'b' && !c.errore)) {
        const altro = casi.find(x => x.gruppo === 'b' && x.luogo === c.luogo && x.profilo !== c.profilo && !x.errore);
        if (altro) coppie.set(c.id, inComune(c, altro));
    }
    const righe = casi.map(c => {
        const m = misuraCaso(c, config);
        const comune = coppie.get(c.id) || null;
        return { c, m, comune, sem: semafori(m, c, config, comune) };
    });
    const L = [];
    L.push(`# Banco nazionale dei tour — ${meta.data || raw.avvio?.slice(0, 10)}`);
    L.push('');
    L.push(`Motore: \`${meta.commit || '?'}\`. Identità: ${raw.identita || '?'} (generazioni etichettate \`test\`). `
        + `Avvio ${raw.avvio || '?'}, fine ${raw.fine || '?'}. Casi: ${casi.length}. `
        + 'Generato da `npm run banco`; soglie e prezzi in `scripts/banco/banco.config.json`.');
    L.push('');
    L.push('Richieste: (a) "Domani, una giornata a <luogo>", nessun profilo; (b) "Domani, una giornata a <luogo>" con il profilo '
        + 'A (arte e chiese, vegetariano, €€€) o B (street food e panorami, nessun vincolo, €); (c) Per Te, adesso; '
        + '(d) posizione Troina, testo "una giornata a Roma".');
    L.push('');

    // ── Semaforo per voce ──
    L.push('## Semaforo per voce');
    L.push('');
    L.push('| Voce | Soglia | Esito | Casi verdi | Casi rossi |');
    L.push('|---|---|---|---|---|');
    const soglia = {
        verita: `${S.veritaPct}% tappe (controllo automatico; quello a mano è sotto)`, voce: `≥ ${S.vocePct}% frasi`,
        distanze: `≥ ${S.entro20Pct}% tratti entro ${S.minutiCammino} min`, ripetizioni: `≤ ${S.ripetizioniMax} evitabili (famiglie ripetute nel giro finale + tappe doppie; le inevitabili, senza alternative nel pool entro 25 min, a parte)`,
        vincoli: `≤ ${S.violazioniMax} violazioni`, inComune: `≤ ${S.inComuneABMaxPct}%`,
        famosita: `≥ ${S.sotto2000MinPct}% tappe ≤ ${S.recensioniFamoso} recensioni (città grandi)`,
        giornata: `≥ ${S.tappeGiornataMin} tappe`, tempo: `itinerario ≤ ${S.secondiItinerarioMax} s, Per Te ≤ ${S.secondiPerTeMax} s`,
        costo: `≤ ${usd(S.costoMaxUsd)}`, destinazione: `città giusta, tappe entro ${S.destinazioneMaxKm} km`,
        percorso: `per giornata: ${S.incrociMax} incroci, al massimo ${S.deviazioniOltreMax} deviazione > ${S.deviazioneMinuti} min, nessuna > ${S.deviazioneMaxMinuti} min`,
        catene: `≤ ${S.cateneMax} marchi ripetuti nella giornata`,
    };
    for (const v of VOCI) {
        const verdi = righe.filter(r => r.sem?.[v] === 'verde').length;
        const rossi = righe.filter(r => r.sem?.[v] === 'rosso');
        const esito = rossi.length ? 'rosso' : (verdi ? 'verde' : null);
        L.push(`| ${NOMI[v]} | ${soglia[v]} | ${ic(esito)} | ${verdi} | ${rossi.length ? `${rossi.length}: ${rossi.map(r => r.c.id).join(', ')}` : '0'} |`);
    }
    L.push('');

    // ── Tabella per luogo ──
    L.push('## Tabella per luogo');
    L.push('');
    L.push('| Caso | Luogo | Tappe | Verità | Voce | Distanze (max · entro 20) | Ripieghi | Ripetizioni (famiglie) | Vincoli | In comune A/B | Famosità (mediana · >2000 · >5000) | Giornata | Tempo | AI · Google | Costo |');
    L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const { c, m, comune, sem } of righe) {
        if (!m) {
            L.push(`| ${c.id} | ${c.luogo} | ${c.saltato ? `saltato: ${cella(c.saltato)}` : `**errore**: ${cella(c.errore)}`} |  |  |  |  |  |  |  |  |  |  |  |  |`);
            continue;
        }
        L.push([
            '', c.id, `${c.luogo}${c.posizione !== c.luogo ? ` (da ${c.posizione})` : ''}`,
            `${m.tappe}${m.perGiro.length > 1 ? ` (${m.perGiro.join('+')})` : ''}`,
            `${ic(sem.verita)} ${n1(m.verita)}%`, `${ic(sem.voce)} ${n1(m.voce)}% di ${m.frasi}`,
            `${ic(sem.distanze)} ${m.maxMinuti ?? '—'} min · ${n1(m.entro20)}%`, String(m.ripieghi),
            `${ic(sem.ripetizioni)} ${m.ripetizioni} (${m.famiglie})`,
            c.vincoli ? `${ic(sem.vincoli)} ${m.violazioni.length}` : '⚪',
            comune ? `${ic(sem.inComune)} ${comune.comuni} · ${n1(comune.pct)}%` : '⚪',
            `${ic(sem.famosita)} ${m.medianaRecensioni ?? '—'} · ${m.sopra2000} · ${m.sopra5000}${m.recensioniNote < m.tappe ? ` (note ${m.recensioniNote}/${m.tappe})` : ''}`,
            c.tipo === 'itinerario' ? `${ic(sem.giornata)} ${m.tappe}` : '⚪',
            `${ic(sem.tempo)} ${n1(m.secondi)} s`, `${m.chiamateAI} · ${m.chiamateGoogle}`,
            `${ic(sem.costo)} ${usd(m.costo.totale)}`, '',
        ].join(' | ').trim());
    }
    L.push('');
    L.push('');
    L.push('### Percorso a piedi (C5)');
    L.push('');
    L.push(`Voce 12, per giornata: incroci del tracciato e deviazione di ogni tappa intermedia B fra la tappa prima A e quella dopo C, `
        + `(A→B + B→C) − A→C in minuti a piedi, anche a cavallo fra due momenti. Verde: ${S.incrociMax} incroci, al massimo `
        + `${S.deviazioniOltreMax} deviazione > ${S.deviazioneMinuti} min, nessuna > ${S.deviazioneMaxMinuti} min; nessuna esenzione per i giri corti. `
        + 'Indice vecchio (cammino reale / minimo libero, C5): solo informazione.');
    L.push('');
    L.push(`| Caso | Luogo | Tappe | Km | Incroci | Deviazioni > ${S.deviazioneMinuti} min | Deviazione max | Indice vecchio | Ripetizioni | Catene doppie | Verdetto |`);
    L.push('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const { c, m, sem } of righe) {
        if (!m?.percorso) continue;
        const p = m.percorso;
        const col = p.giornate.map(g => g.colpevole).find(Boolean);
        L.push(`| ${c.id} | ${c.luogo} | ${m.tappe} | ${n1(p.km)} | ${p.incroci} | ${p.deviazioniOltre} | ${n1(p.deviazioneMax)} min${col ? ` (${cella(col.titolo)} @${col.momento})` : ''} | ${n1(p.indiceLibero)} | ${ic(sem.ripetizioni)} ${m.ripetizioni}${m.ripetizioniInevitabili ? ` (+${m.ripetizioniInevitabili} inevitabili)` : ''} | ${ic(sem.catene)} ${p.catene} | ${ic(sem.percorso)} |`);
    }
    L.push('');
    L.push('⚪ = la voce non si applica al caso (vincoli solo per i profili, A/B solo per (b), famosità solo nelle città grandi, giornata solo per gli itinerari).');
    const d = righe.find(r => r.m?.destinazione);
    if (d) L.push(`Destinazione (d): ${ic(d.sem.destinazione)} uscito a **${d.m.destinazione.citta}** (atteso ${d.m.destinazione.attesa})${d.m.destinazione.tappeLontane.length ? `, tappe lontane: ${d.m.destinazione.tappeLontane.join(', ')}` : ', tutte le tappe entro ' + S.destinazioneMaxKm + ' km dal centro'}.`);
    L.push('');

    // ── Voci rosse ──
    L.push('## Voci rosse e causa probabile');
    L.push('');
    L.push('Indizi letti in automatico dai dati del caso: dicono dove guardare, non correggono niente.');
    L.push('');
    const rosse = righe.flatMap(r => VOCI.filter(v => r.sem?.[v] === 'rosso').map(v => ({ ...r, v })));
    if (!rosse.length) L.push('Nessuna.');
    for (const r of rosse) L.push(`- **${r.c.id} — ${NOMI[r.v]}**: ${cella(indizi(r.v, r.m, r.c, r.comune, S))}`);
    const note = casi.filter(c => c.nota);
    if (note.length) {
        L.push('');
        L.push('Note sul giro:');
        for (const c of note) L.push(`- ${c.id}: ${c.nota}`);
    }
    const ko = casi.filter(c => c.errore || c.saltato);
    if (ko.length) {
        L.push('');
        L.push('Casi non misurati:');
        for (const c of ko) L.push(`- ${c.id}: ${c.saltato ? `saltato — ${c.saltato}` : `errore — ${c.errore}`}`);
    }
    L.push('');

    // ── Frasi per il controllo a mano ──
    L.push('## Frasi per il controllo a mano');
    L.push('');
    L.push('Ogni descrizione a schermo, tappa per tappa. "auto" = controllo automatico (rete + testo pulito + fatto vero; voce = nessun problema di `voiceIssues`). '
        + 'Il giudizio a mano è più severo: la colonna "A mano" è da riempire.');
    L.push('');
    for (const { c, m } of righe) {
        if (!m) continue;
        L.push(`### ${c.id} — ${c.luogo}${c.profiloNome ? ` · profilo ${c.profilo}: ${c.profiloNome}` : ''}`);
        L.push('');
        L.push('| Tappa | Rec. | Min | Scelta | Descrizione | Verità auto | Voce auto | A mano |');
        L.push('|---|---|---|---|---|---|---|---|');
        for (const t of c.tours || []) {
            for (const s of t.stops) {
                L.push(`| ${cella(c.tipo === 'perte' ? `${t.tema}: ${s.title}` : s.title)} | ${s.recensioni ?? '—'} | ${s.min ?? '—'} | ${s.scelta || '—'} | ${cella(s.description)} | ${s.verita ? '✓' : '✗'} | ${s.frasi.every(f => !f.problemi.length) ? '✓' : '✗'} |  |`);
            }
        }
        L.push('');
    }
    return { markdown: L.join('\n'), righe };
}
