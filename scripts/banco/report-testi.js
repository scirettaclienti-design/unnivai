// TESTI — i testi a schermo: italiano, concordati, onesti, mai ripetuti. Il report del giro sui 6 casi:
// i semafori di tutte le classi (c7 e c8 in primo piano), le ripetizioni anche a 2 volte (il controllo c7 scatta a 3: qui si conta
// anche 2, senza cambiare il controllo), la frase di riserva «X è la prossima tappa del tuo giro», le etichette di tipo, le sezioni,
// il meteo, i titoli. Funzione pura: grezzi in, markdown e numeri fuori.
import { costoUsd } from './misure.js';
import { usd } from './sezioni.js';
import { eseguiControlli } from './controlli.js';
import { NOMI_MODO } from './casi-esteso.js';
import { giornoEMinuti } from './orari.js';

export { unisciGrezzi } from './report-minimi.js';

const CLASSI = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c10', 'c11', 'c12', 'c13'];
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const tappe = (c) => (c.tours || []).flatMap(t => (t.stops || []));
const vere = (c) => tappe(c).filter(s => !s.tempoLibero);
const hhmm = (iso) => { const q = iso ? giornoEMinuti(iso) : null; return q ? `${String(Math.floor(q.minuti / 60)).padStart(2, '0')}:${String(q.minuti % 60).padStart(2, '0')}` : '—'; };
const frasiDi = (t) => String(t || '').split(/(?<=[.!?])\s+/).map(f => f.trim()).filter(Boolean);
const maschera = (f, nome) => norm(f).split(norm(nome)).join('<nome>').replace(/\d+/g, '<n>');
const cella = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');
const SEM = (n) => (n === 0 ? '🟢' : '🔴');

/** Le frasi uguali (nome e numeri mascherati) almeno `min` volte nella giornata di un caso. */
export function ripetute(c, min = 2) {
    const m = new Map();
    for (const s of vere(c)) for (const f of frasiDi(s.description)) {
        const k = maschera(f, s.title);
        const l = m.get(k) || [];
        l.push({ f, titolo: s.title });
        m.set(k, l);
    }
    return [...m.values()].filter(l => l.length >= min);
}

const RISERVA = /è la prossima tappa del tuo giro/;

export function reportTesti(nuovo, config, meta = {}) {
    const casi = nuovo.casi.filter(c => !c.errore && !c.saltato);
    const sintesi = { casi: nuovo.casi.length, misurati: casi.length, spesa: usd(nuovo.spesa), spesaNum: nuovo.spesa, c1: 0, c7: 0, c8: 0, classi: {} };
    const ctrl = new Map(casi.map(c => [c.id, eseguiControlli({ ...c, orari: c.orari || {} }, config)]));
    for (const k of CLASSI) sintesi.classi[k] = casi.reduce((a, c) => a + (ctrl.get(c.id)?.[k]?.violazioni.length || 0), 0);
    sintesi.c1 = sintesi.classi.c1; sintesi.c7 = sintesi.classi.c7; sintesi.c8 = sintesi.classi.c8;
    const L = [];
    L.push('# TESTI — quello che l\'utente legge è italiano, giusto, onesto e mai ripetuto');
    L.push('');
    L.push(`Codice al momento del report: \`${meta.commit || '?'}\`; grezzi: ${(meta.files || []).map(f => `\`${f}\``).join(', ')}; \`engine=new\` (solo l'account di prova), giorno simulato **${nuovo.giornoSimulato}**. `
        + `${sintesi.casi} casi girati sul codice finale (uno per modalità, più Crea Catania 18:00 e Veloce Catania 22:20); ${sintesi.misurati} misurati.`);
    L.push('');

    // ── 1. semafori ──
    L.push('## I semafori sui casi');
    L.push('');
    L.push('| Caso | Modalità | Ora | Tappe | Tempo libero | ' + CLASSI.map(k => k).join(' | ') + ' |');
    L.push('|---|---|---|---|---|' + CLASSI.map(() => '---').join('|') + '|');
    for (const c of nuovo.casi) {
        if (c.errore || c.saltato) { L.push(`| ${c.id} | ${NOMI_MODO[c.modo] || c.modo} | ${c.ora} | — | — | ${CLASSI.map(() => '⚪').join(' | ')} |`); continue; }
        const r = ctrl.get(c.id);
        L.push(`| ${c.id} | ${NOMI_MODO[c.modo] || c.modo} | ${c.ora} | ${vere(c).length} | ${tappe(c).filter(s => s.tempoLibero).length} | ${CLASSI.map(k => (r[k]?.applicabile === false ? '⚪' : `${SEM(r[k].violazioni.length)}${r[k].violazioni.length || ''}`)).join(' | ')} |`);
    }
    L.push('');
    L.push(`Totale violazioni: c7 **${sintesi.c7}**, c8 **${sintesi.c8}**, c1 **${sintesi.c1}**. Le altre classi: ${CLASSI.filter(k => !['c1', 'c7', 'c8'].includes(k)).map(k => `${k} ${sintesi.classi[k]}`).join(', ')}.`);
    L.push('');
    for (const k of ['c1', 'c7', 'c8']) {
        const lista = casi.flatMap(c => (ctrl.get(c.id)?.[k]?.violazioni || []).map(v => `- **${c.id}** — ${v.testo}`));
        if (lista.length) { L.push(`Violazioni ${k}:`); L.push(''); L.push(...lista); L.push(''); }
    }

    // ── 2. ripetizioni ──
    L.push('## Ripetizioni: nessuna frase uguale due volte nello stesso tour');
    L.push('');
    L.push('Il controllo c7 scatta a **3** volte (`frasiUgualiMin`, non cambiato); qui si conta anche a **2**, che è la regola dell\'obiettivo.');
    L.push('');
    L.push('| Caso | Frasi della giornata | Uguali ≥2 volte | Uguali ≥3 volte |');
    L.push('|---|---|---|---|');
    let tot2 = 0;
    for (const c of casi) {
        const n = vere(c).flatMap(s => frasiDi(s.description)).length;
        const r2 = ripetute(c, 2), r3 = ripetute(c, 3);
        tot2 += r2.length;
        L.push(`| ${c.id} | ${n} | ${r2.length} | ${r3.length} |`);
    }
    L.push('');
    const elenco2 = casi.flatMap(c => ripetute(c, 2).map(l => `- **${c.id}** — «${l[0].f}» (${l.map(x => x.titolo).join(', ')})`));
    L.push(elenco2.length ? `Frasi ripetute (${tot2}):\n\n${elenco2.join('\n')}` : 'Nessuna frase ripetuta, in nessun caso.');
    L.push('');

    // ── 3. frase di riserva ──
    L.push('## La frase di riserva «X è la prossima tappa del tuo giro»');
    L.push('');
    const conRiserva = casi.flatMap(c => vere(c).filter(s => RISERVA.test(s.description || '')).map(s => ({ c, s })));
    const tutte = casi.reduce((a, c) => a + vere(c).length, 0);
    L.push(`Esce **${conRiserva.length} volte su ${tutte} tappe** (${tutte ? Math.round((conRiserva.length / tutte) * 100) : 0}%) nei ${casi.length} casi.`);
    L.push('');
    if (conRiserva.length) {
        L.push('| Caso | Tappa | Tipo principale | Momento | Famiglia della frase | Frase |');
        L.push('|---|---|---|---|---|---|');
        for (const { c, s } of conRiserva) L.push(`| ${c.id} | ${cella(s.title)} | ${s.primaryType || '—'} | ${s.moment || '—'} | ${s.famiglia || '—'} | ${cella(s.description)} |`);
        L.push('');
    }

    // ── 4. etichette di tipo ──
    L.push('## Etichette di tipo: cosa legge l\'utente su ogni tappa');
    L.push('');
    L.push('| Caso | Tappa | Tipo interno (prima) | Tipo principale Google | Etichetta (dopo) |');
    L.push('|---|---|---|---|---|');
    const senza = new Map();
    for (const c of casi) for (const s of vere(c)) {
        L.push(`| ${c.id} | ${cella(s.title)} | ${s.tipoInterno || '—'} | ${s.primaryType || '—'} | ${s.etichetta ? `**${s.etichetta}**` : '*(nessuna)*'} |`);
        if (!s.etichetta) senza.set(s.primaryType || '(manca)', (senza.get(s.primaryType || '(manca)') || 0) + 1);
    }
    L.push('');
    L.push(senza.size ? `Tappe senza etichetta (tipo senza traduzione): ${[...senza].map(([k, n]) => `\`${k}\` ×${n}`).join(', ')}.` : 'Ogni tappa ha la sua etichetta.');
    L.push('');

    // ── 5. sezioni, meteo, titoli ──
    L.push('## Sezioni, meteo e titoli come li mostra la schermata');
    L.push('');
    L.push('| Caso | Titolo del giorno | Meteo | Sezioni (nome @ ora della prima tappa) |');
    L.push('|---|---|---|---|');
    for (const c of casi) {
        const g = c.schermo?.giorni || [];
        const sez = (c.schermo?.sezioni || []).map(z => `${z.etichetta} @ ${z.ora || '—'}`).join(' · ') || '—';
        L.push(`| ${c.id} | ${g.map(x => `«${cella(x.titolo)}»`).join(', ') || '—'} | ${g.map(x => (x.meteo ? `${x.meteo.condition ?? '(senza condizione)'}, ${x.meteo.temperature}°C` : 'nessuno')).join(', ') || '—'} | ${sez} |`);
    }
    L.push('');

    // ── 6. tutti i testi ──
    L.push('## Tutti i testi del giro, tappa per tappa');
    L.push('');
    for (const c of casi) {
        L.push(`### ${c.id} — ${NOMI_MODO[c.modo] || c.modo}, ${c.ora}, ${c.luogo}`);
        L.push('');
        for (const t of c.tours || []) {
            if (t.tema && (c.tours || []).length > 1) L.push(`*${t.tema}*`);
            for (const s of t.stops || []) L.push(`- ${hhmm(s.at)} **${cella(s.title)}**${s.moment ? ` (${s.moment})` : ''}${s.etichetta ? ` [${s.etichetta}]` : ''}: ${s.tempoLibero ? 'Tempo libero. ' : ''}${cella(s.description)}`);
        }
        L.push('');
    }

    // ── 7. spesa ──
    L.push('## Spesa');
    L.push('');
    L.push(`Totale del giro (token + Google contati; foto non caricate): **${usd(nuovo.spesa)}**. ${(nuovo.file || []).map(f => `${f.nome}: ${usd(f.spesa)} (${f.casi} casi)`).join('; ')}.`);
    L.push('');
    const gen = casi.map(c => ({ id: c.id, usd: costoUsd(c, config.prezziUsd).totale }));
    L.push(`Per caso: ${gen.map(x => `${x.id} ${usd(x.usd)}`).join(', ')}.`);
    L.push('');
    return { markdown: L.join('\n'), sintesi };
}
