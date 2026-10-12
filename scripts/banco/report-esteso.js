// BANCO-ESTESO — dal grezzo del giro al report in markdown. Funzione pura.
import { eseguiControlli, c9, CLASSI, DEFINIZIONI } from './controlli.js';
import { misuraCaso, semafori, VOCI } from './misure.js';
import { validaControlli } from './validazione.js';
import { NOMI_MODO, MODI } from './casi-esteso.js';

const ic = (s) => ({ verde: '🟢', rosso: '🔴' }[s] || '⚪');
const cella = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const usd = (x) => `$${x.toFixed(2).replace('.', ',')}`;
const NOMI_VOCE = { verita: 'Verità', voce: 'Voce', distanze: 'Distanze', ripetizioni: 'Ripetizioni', vincoli: 'Vincoli', inComune: 'In comune A/B',
    famosita: 'Famosità', giornata: 'Giornata', tempo: 'Tempo', costo: 'Costo', destinazione: 'Destinazione', percorso: 'Percorso', catene: 'Catene' };
// Le 12 voci dell'asticella (la tredicesima, "catene", è un'estensione del banco: si mostra a parte).
const DODICI = VOCI.filter(v => v !== 'catene');

/** Le prove e i numeri del giro: tutto quello che il report mostra, calcolato una volta. */
export function analizza(raw, config) {
    const casi = raw.casi || [];
    const righe = casi.map(c => ({ c, ctrl: eseguiControlli({ ...c, orari: c.orari || {} }, config), m: misuraCaso(c, config) }));
    const ok = righe.filter(r => r.ctrl);
    const onb = c9(raw.onb1 ?? null, config);
    const perClasse = CLASSI.map(([k, nome]) => {
        if (k === 'c9') return { k, nome, applicabili: 1, casiRossi: onb.violazioni.length ? 1 : 0, violazioni: onb.violazioni.length, sconosciuti: 0 };
        const app = ok.filter(r => r.ctrl[k].applicabile);
        return { k, nome, applicabili: app.length, casiRossi: app.filter(r => r.ctrl[k].violazioni.length).length,
            violazioni: app.reduce((a, r) => a + r.ctrl[k].violazioni.length, 0), sconosciuti: app.reduce((a, r) => a + (r.ctrl[k].sconosciuti || 0), 0) };
    });
    const perModo = MODI.map(modo => {
        const rs = ok.filter(r => r.c.modo === modo);
        const perK = Object.fromEntries(CLASSI.filter(([k]) => k !== 'c9').map(([k]) => [k, rs.reduce((a, r) => a + r.ctrl[k].violazioni.length, 0)]));
        return { modo, casi: rs.length, saltati: righe.filter(r => r.c.modo === modo && !r.ctrl).length, conErrori: rs.filter(r => Object.values(r.ctrl).some(x => x.violazioni.length)).length,
            totale: Object.values(perK).reduce((a, b) => a + b, 0), perK };
    });
    const gravi = ok.flatMap(r => Object.entries(r.ctrl).flatMap(([k, x]) => x.violazioni.map(v => ({ caso: r.c, classe: k, ...v }))))
        .concat(onb.violazioni.map(v => ({ caso: { id: '(giro)', modo: null, luogo: '—', ora: '' }, classe: 'c9', ...v })))
        .sort((a, b) => b.gravita - a.gravita || a.caso.id.localeCompare(b.caso.id));
    return { righe, ok, onb, perClasse, perModo, gravi };
}

export function buildReportEsteso(raw, config, meta = {}) {
    const E = config.esteso;
    const A = analizza(raw, config);
    const L = [];
    const data = meta.data || raw.avvio?.slice(0, 10);
    L.push(`# Banco esteso — matrice dei casi reali e controlli automatici (${data})`);
    L.push('');
    L.push(`Motore: \`${meta.commit || '?'}\`. Identità: ${raw.identita || '?'} (generazioni etichettate \`test\`). Avvio ${raw.avvio || '?'}, fine ${raw.fine || '?'}. `
        + `Casi: ${A.righe.length} (${A.ok.length} girati). Generato da \`npm run banco:esteso\`; soglie, fasce, pesi e tetti in \`scripts/banco/banco.config.json\` (sezione \`esteso\`).`);
    L.push('');
    L.push(`Ora simulata: ogni caso gira come se la richiesta fosse fatta il **${E.giornoSimulato} (mercoledì)** all'ora indicata, ora di Roma (\`opts.simulatedNow\`, ignorato in produzione).`);
    L.push('');

    // ── Modalità ──
    L.push('## Modalità coperte');
    L.push('');
    L.push('| Modalità | Pagina replicata | Chiamata | Casi girati | Esito |');
    L.push('|---|---|---|---|---|');
    const chiamate = { crea: ['AiItinerary.jsx', "`pathType: 'custom'`, prefs del wizard (budget, durata, interessi, gruppo, ritmo), testo libero"],
        veloce: ['QuickPath.jsx', "`pathType: 'quick'`, testo da `buildPromptFromSelections`, durata e interessi del wizard, **nessun ritmo** (come l'app)"],
        sorprendimi: ['SurpriseTour.jsx', "nessun `pathType`, 'Mezza Giornata', prompt della pagina, `cityCenter = {latitude, longitude}`"],
        perte: ['DashboardUser.jsx', '`discoverAllThemes` + `buildInsiderPool` + `generateHomeTours`, prefs `1 Giorno / solo / rilassato`'] };
    for (const m of A.perModo) {
        L.push(`| ${NOMI_MODO[m.modo]} | ${chiamate[m.modo][0]} | ${chiamate[m.modo][1]} | ${m.casi}${m.saltati ? ` (+${m.saltati} non girati)` : ''} | ${m.casi ? 'coperta' : '**non coperta**'} |`);
    }
    L.push('');

    // ── Matrice ──
    L.push('## Matrice dei casi');
    L.push('');
    L.push('| Caso | Modalità | Luogo | Ora | Richiesta / scelta | Vincolo |');
    L.push('|---|---|---|---|---|---|');
    for (const { c } of A.righe) {
        const richiesta = c.modo === 'veloce' ? `Veloce: ${c.chiamata?.prefs?.interests?.join(' › ') || ''}, ${c.chiamata?.prefs?.duration || ''}` : c.modo === 'sorprendimi' ? `Sorprendimi${c.chiamata?.prefs?.interests?.length === 1 ? ` (tema ${c.chiamata.prefs.interests[0]})` : ''}` : c.modo === 'perte' ? 'Per Te' : c.chiamata?.testo ?? c.richiesta;
        L.push(`| ${c.id} | ${NOMI_MODO[c.modo]} | ${c.luogo} | ${c.ora} | ${cella(richiesta)} | ${c.onboarding?.dieta?.length ? c.onboarding.dieta.join('+') : '—'} |`);
    }
    L.push('');
    L.push('Ore per modalità: ' + A.perModo.map(m => `${NOMI_MODO[m.modo]} ${[...new Set(A.righe.filter(r => r.c.modo === m.modo).map(r => r.c.ora))].sort().join(', ')}`).join(' · ') + '.');
    L.push('');

    // ── Tabella caso × classe ──
    L.push('## Caso × classe di errore');
    L.push('');
    L.push('Cella = numero di violazioni (🔴), 🟢 = nessuna, ⚪ = non si applica; in c3/c5 «+n?» = posti con orario sconosciuto (contati a parte, non sono errori).');
    L.push('');
    L.push(`| Caso | Tappe | ${CLASSI.filter(([k]) => k !== 'c9').map(([k]) => k).join(' | ')} |`);
    L.push(`|---|---|${CLASSI.filter(([k]) => k !== 'c9').map(() => '---').join('|')}|`);
    for (const { c, ctrl, m } of A.righe) {
        if (!ctrl) { L.push(`| ${c.id} | ${c.saltato ? `non girato: ${cella(c.saltato)}` : `**errore** ${cella(c.errore)}`} |${CLASSI.filter(([k]) => k !== 'c9').map(() => '').join('|')}|`); continue; }
        const cel = (k) => { const x = ctrl[k]; if (!x.applicabile) return '⚪'; const sc = x.sconosciuti ? ` +${x.sconosciuti}?` : ''; return x.violazioni.length ? `🔴 ${x.violazioni.length}${sc}` : `🟢${sc}`; };
        L.push(`| ${c.id} | ${m.tappe} | ${CLASSI.filter(([k]) => k !== 'c9').map(([k]) => cel(k)).join(' | ')} |`);
    }
    L.push('');

    // ── Totali ──
    L.push('## Totali per classe');
    L.push('');
    L.push('| Classe | Definizione (sintesi) | Casi applicabili | Casi con errore | Violazioni | Sconosciuti |');
    L.push('|---|---|---|---|---|---|');
    for (const c of A.perClasse) L.push(`| ${c.k} — ${c.nome} | ${cella(DEFINIZIONI[c.k].split('. ')[0])}… | ${c.applicabili} | ${ic(c.casiRossi ? 'rosso' : 'verde')} ${c.casiRossi} | ${c.violazioni} | ${c.sconosciuti || '—'} |`);
    L.push('');
    L.push(`c9 è del giro (ONB-1), non di un caso: ${A.onb.violazioni.length ? '🔴 ' + A.onb.violazioni.map(v => v.testo).join('; ') : `🟢 ${raw.onb1?.passi?.length ?? 0} passi su ${raw.onb1?.passi?.length ?? 0} OK`}.`);
    L.push('');
    const c5 = A.perClasse.find(c => c.k === 'c5');
    const o = raw.orariRiepilogo;
    L.push(`**Orari (c3/c5).** ${o ? `${o.postiDistinti} posti distinti: orari chiesti per ${o.chiamati}, ${o.nonRichiesti} non richiesti per il tetto di spesa, ${o.senzaOrari} senza orari su Google.` : 'Nessun orario preso.'} `
        + `Tappe con orario sconosciuto: **${c5.sconosciuti}** (contate a parte, non sono violazioni). Il pool porta solo \`open_now\` (textsearch), non i periodi: gli orari sono presi con place/details dopo la generazione.`);
    L.push('');
    L.push('### Per modalità');
    L.push('');
    const KS = CLASSI.filter(([k]) => k !== 'c9').map(([k]) => k);
    L.push(`| Modalità | Casi | Casi con ≥1 errore | Violazioni | ${KS.join(' | ')} |`);
    L.push(`|---|---|---|---|${KS.map(() => '---').join('|')}|`);
    for (const m of A.perModo) L.push(`| ${NOMI_MODO[m.modo]} | ${m.casi} | ${m.conErrori} | ${m.totale} | ${KS.map(k => m.perK[k]).join(' | ')} |`);
    L.push('');

    // ── 12 voci ──
    L.push("## Le 12 voci dell'asticella (stesse misure del banco nazionale)");
    L.push('');
    L.push(`| Caso | ${DODICI.map(v => NOMI_VOCE[v]).join(' | ')} | Catene |`);
    L.push(`|---|${DODICI.map(() => '---').join('|')}|---|`);
    const semi = A.righe.map(r => ({ ...r, sem: r.m ? semafori(r.m, r.c, config, null) : null }));
    for (const r of semi) L.push(`| ${r.c.id} | ${r.sem ? DODICI.map(v => ic(r.sem[v])).join(' | ') : DODICI.map(() => '').join(' | ')} | ${r.sem ? ic(r.sem.catene) : ''} |`);
    L.push('');
    L.push('| Voce | Casi verdi | Casi rossi |');
    L.push('|---|---|---|');
    for (const v of VOCI) {
        const rossi = semi.filter(r => r.sem?.[v] === 'rosso');
        L.push(`| ${NOMI_VOCE[v]}${v === 'catene' ? ' (estensione)' : ''} | ${semi.filter(r => r.sem?.[v] === 'verde').length} | ${rossi.length}${rossi.length ? `: ${rossi.map(r => r.c.id).join(', ')}` : ''} |`);
    }
    L.push('');
    L.push('⚪ = la voce non si applica (vincoli solo con una dieta, famosità solo nelle città grandi, giornata solo per gli itinerari, In comune A/B solo nel banco nazionale). «Tempo» e «Costo» usano le soglie del banco nazionale (35 s, $0,20 per caso).');
    L.push('');

    // ── Peggiori ──
    L.push('## I 10 errori più gravi');
    L.push('');
    L.push('Ordine: peso della classe (`esteso.gravita`), poi caso. Il testo è quello che l\'utente vede (frase della tappa, orario, meteo).');
    L.push('');
    const visti = new Set();
    let n = 0;
    for (const g of A.gravi) {
        const chiave = `${g.caso.id}|${g.classe}|${g.tappa}`;
        if (visti.has(chiave)) continue;
        visti.add(chiave);
        const stop = (g.caso.tours || []).flatMap(t => t.stops || []).find(s => s.title === g.tappa);
        n++;
        L.push(`${n}. **${g.caso.id}** (${g.caso.modo ? NOMI_MODO[g.caso.modo] : 'giro'}, ${g.caso.luogo} ${g.caso.ora}) — **${g.classe}**, ${CLASSI.find(([k]) => k === g.classe)[1]}: ${g.testo}`
            + `${stop ? `\n   - A schermo: «${stop.title}» ${stop.moment ? `(${stop.moment}${stop.at ? `, ${new Date(stop.at).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })}` : ''})` : ''}: «${cella(stop.description)}»` : ''}`);
        if (n >= 10) break;
    }
    if (!n) L.push('Nessun errore rilevato.');
    L.push('');

    // ── Validazione ──
    L.push('## Validazione dei controlli');
    L.push('');
    L.push('Ogni controllo deve dare ROSSO su un esempio cattivo noto e VERDE su uno buono, prima del giro (`scripts/banco/validazione.js`, provata in `src/__tests__/scripts/bancoEsteso.test.js`).');
    L.push('');
    L.push('| Classe | Esempio cattivo (origine) | Rosso? | Cosa ha visto | Esempio buono | Verde? |');
    L.push('|---|---|---|---|---|---|');
    for (const v of validaControlli(config)) L.push(`| ${v.classe} | ${cella(v.cattivo)} (${cella(v.origine)}) | ${v.cattivoRosso ? '🔴 sì' : '❌ NO'} | ${cella(v.visto.join(' ; '))} | ${cella(v.buono)} | ${v.buonoVerde ? '🟢 sì' : '❌ NO: ' + cella(v.falsiAllarmi.join(' ; '))} |`);
    L.push('');
    L.push('### Definizioni');
    L.push('');
    for (const [k, nome] of CLASSI) L.push(`- **${k} — ${nome}.** ${DEFINIZIONI[k]}`);
    L.push('');

    // ── Costo ──
    L.push('## Costo');
    L.push('');
    const co = raw.costo;
    if (co) {
        const calc = (co.google ? Object.entries(co.google).map(([k, v]) => `${k} ×${v}`).join(', ') : '');
        L.push(`Totale (token + Google contati; foto non caricate dallo script): **${usd(co.totale)}** su un tetto di ${usd(co.tettoUsd)}. AI: ${co.ai.chiamate} chiamate, ${co.ai.tokenIn} token in, ${co.ai.tokenOut} out. Google: ${calc}. `
            + 'Prezzi del listino in `banco.config.json` (place/details a $0,025 anche se per `fields=opening_hours` può costare meno: stima prudente).');
        const medio = A.ok.length ? A.ok.reduce((a, r) => a + (r.m?.costo.totale ?? 0), 0) / A.ok.length : 0;
        L.push('');
        L.push(`Per caso, con la stima delle foto del banco nazionale (1 per tappa): in media ${usd(medio)}.`);
    } else L.push('Costo non registrato (giro interrotto).');
    L.push('');
    const ko = A.righe.filter(r => r.c.errore || r.c.saltato);
    if (ko.length) {
        L.push('## Casi non misurati');
        L.push('');
        for (const { c } of ko) L.push(`- ${c.id}: ${c.saltato ? `non girato — ${c.saltato}` : `errore — ${c.errore}`}`);
        L.push('');
    }
    if (meta.note) { L.push(meta.note); L.push(''); }
    return { markdown: L.join('\n'), analisi: A };
}
